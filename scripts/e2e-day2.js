import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import mongoose from 'mongoose';
import { database } from '../unfazed-backend/test/helpers.js';
import { app } from '../unfazed-backend/src/app.js';
import { attachSchedulingSocket } from '../unfazed-backend/src/sockets/schedulingSocket.js';
import { attachChatSocket } from '../unfazed-backend/src/sockets/chatSocket.js';
import { matchesSignature } from '../unfazed-backend/src/services/paymentGateway.js';
import { NotificationService } from '../unfazed-backend/src/services/notificationService.js';
import { deliverNotifications } from '../unfazed-backend/src/services/notificationDeliveryService.js';
import { scheduleSessionEvents } from '../unfazed-backend/src/services/sessionNotificationService.js';
import Therapist from '../unfazed-backend/src/models/Therapist.js';
import Client from '../unfazed-backend/src/models/Client.js';
import Session from '../unfazed-backend/src/models/Session.js';
import SubscriptionTierConfig from '../unfazed-backend/src/models/SubscriptionTierConfig.js';
import DomainEvent from '../unfazed-backend/src/models/DomainEvent.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-browser-test-secret-never-for-production';
process.env.EMAIL_ENABLED = 'false';
const fixtureSecret = 'browser-gateway-fixture-only';
let server, io, browser, close, therapistPage, clientPage;
const artifacts = '/tmp/unfazed-day2-e2e';
await mkdir(artifacts, { recursive: true });
try {
  close = await database();
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  server = createServer(app);
  io = attachSchedulingSocket(server);
  attachChatSocket(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.PUBLIC_BASE_URL = origin;
  async function api(path, token, body, method = 'GET', status = 200) {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
    return response.json();
  }
  const orders = new Map(),
    captures = new Map();
  let sequence = 0;
  app.locals.paymentGateway = {
    publicKey: () => 'rzp_test_browser_fixture',
    createOrder: async (data) => {
      const order = { ...data, id: `order_browser_${++sequence}` };
      orders.set(order.id, order);
      return order;
    },
    fetchPayment: async (id) => captures.get(id),
    verifyCheckout: (order, payment, signature) =>
      matchesSignature(`${order}|${payment}`, signature, fixtureSecret),
    verifyWebhook: (raw, signature) => matchesSignature(raw, signature, fixtureSecret),
  };
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const therapistContext = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
  const clientContext = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
  for (const context of [therapistContext, clientContext])
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  await clientContext.exposeFunction('completeFixturePayment', async (options) => {
    const order = orders.get(options.order_id),
      paymentId = `pay_browser_${sequence}`;
    const capture = {
      id: paymentId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: 'captured',
    };
    captures.set(paymentId, capture);
    const raw = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: capture } },
    });
    const response = await fetch(`${origin}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-event-id': `browser-capture-${paymentId}`,
        'x-razorpay-signature': createHmac('sha256', fixtureSecret).update(raw).digest('hex'),
      },
      body: raw,
    });
    assert.equal(response.status, 200, await response.text());
    return {
      razorpay_order_id: order.id,
      razorpay_payment_id: paymentId,
      razorpay_signature: createHmac('sha256', fixtureSecret)
        .update(`${order.id}|${paymentId}`)
        .digest('hex'),
    };
  });
  await clientContext.addInitScript(() => {
    window.Razorpay = class {
      constructor(options) {
        this.options = options;
      }
      on() {}
      open() {
        window.completeFixturePayment(this.options).then(this.options.handler);
      }
    };
  });
  therapistPage = await therapistContext.newPage();
  clientPage = await clientContext.newPage();
  async function visible(page, locator) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
  }
  await therapistPage.goto(`${origin}/register`);
  await therapistPage.getByLabel('Your name').fill('Dr Browser Fixture');
  await therapistPage.getByLabel('Email', { exact: true }).fill('browsertherapist@example.test');
  await therapistPage.getByLabel('Password').fill('Browser-fixture-password!');
  await therapistPage.getByRole('button', { name: 'Create account' }).click();
  await therapistPage.waitForURL('**/dashboard');
  await therapistPage.getByRole('button', { name: 'Sign out', exact: true }).click();
  await therapistPage.goto(`${origin}/login`);
  await therapistPage.getByLabel('Email', { exact: true }).fill('browsertherapist@example.test');
  await therapistPage.getByLabel('Password').fill('Browser-fixture-password!');
  await therapistPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await therapistPage.waitForURL('**/dashboard');
  const token = await therapistPage.evaluate(() => sessionStorage.getItem('unfazed-token'));
  const account = (await api('/auth/me', token)).therapist;
  await therapistPage.getByRole('link', { name: 'Profile', exact: true }).click();
  await therapistPage
    .getByLabel('About your practice')
    .fill('A warm and supportive private practice.');
  await therapistPage.getByRole('button', { name: 'Add service' }).click();
  await therapistPage.getByLabel('Service name').fill('Individual therapy');
  await therapistPage.getByLabel('Fee (INR)').fill('1500');
  await therapistPage.getByRole('button', { name: 'Save profile' }).click();
  await visible(therapistPage, therapistPage.getByText('Profile saved.'));
  const profile = (await api('/therapists/me', token)).therapist;
  assert.ok(profile.slug);
  await therapistPage.getByRole('link', { name: 'Schedule', exact: true }).click();
  await therapistPage.getByRole('button', { name: 'Add hours' }).nth(1).click();
  await therapistPage.getByRole('button', { name: 'Save weekly hours' }).click();
  await visible(therapistPage, therapistPage.getByText('Availability saved.'));
  console.log('PASS browser: registration, login, profile, branded URL and availability');
  await clientPage.goto(`${origin}/${profile.slug}`);
  await clientPage.getByRole('link', { name: 'Choose a time' }).click();
  await clientPage.getByLabel('Starting date').fill('2030-01-07');
  await clientPage.getByRole('button', { name: 'Mon, 7 Jan · 9:00 AM', exact: true }).click();
  await clientPage.getByLabel('Your name', { exact: true }).fill('Browser Client');
  await clientPage.getByLabel('Email', { exact: true }).fill('browserclient@example.test');
  await clientPage.getByRole('button', { name: 'Reserve time' }).click();
  await clientPage.getByLabel('Age', { exact: true }).fill('29');
  await clientPage
    .getByLabel('What brings you here?')
    .fill('Support with work stress and wellbeing.');
  await clientPage.getByRole('checkbox').check();
  await clientPage.getByRole('button', { name: 'Submit intake' }).click();
  await visible(clientPage, clientPage.getByText('Intake and consent saved.'));
  await clientPage.getByRole('button', { name: 'Pay with Razorpay' }).click();
  await visible(clientPage, clientPage.getByText('Payment confirmed.', { exact: true }));
  const downloadPromise = clientPage.waitForEvent('download');
  await clientPage.getByRole('button', { name: 'Download invoice' }).click();
  const download = await downloadPromise;
  await download.saveAs(`${artifacts}/invoice.pdf`);
  await clientPage.getByRole('link', { name: 'Open your client portal' }).click();
  await visible(clientPage, clientPage.getByRole('heading', { name: 'Hello, Browser Client.' }));
  const clientToken = await clientPage.evaluate(() =>
    sessionStorage.getItem('unfazed-client-token'),
  );
  const client = (await api('/portal/me', clientToken)).client;
  console.log(
    'PASS browser: branded profile, slot booking, intake, consent, fixture checkout, signed capture and invoice',
  );
  await therapistPage.getByRole('link', { name: 'Clients', exact: true }).click();
  await therapistPage.getByRole('link', { name: 'Browser Client' }).click();
  await visible(
    therapistPage,
    therapistPage.getByRole('heading', { name: 'Clinical documentation' }),
  );
  for (const [type, title, text] of [
    ['private', 'Private clinical note', 'This is private therapist information.'],
    ['shared', 'Shared reflection', 'This information is safe for the client.'],
  ]) {
    await therapistPage.getByLabel('Note title').fill(title);
    await therapistPage.getByLabel('Visibility').selectOption(type);
    await therapistPage.getByRole('textbox', { name: 'Note content' }).fill(text);
    await therapistPage.getByRole('button', { name: 'Save note' }).click();
    await visible(therapistPage, therapistPage.getByRole('heading', { name: title, exact: true }));
  }
  await clientPage.reload();
  await visible(
    clientPage,
    clientPage.getByText('This information is safe for the client.', { exact: true }),
  );
  assert.equal(
    await clientPage.getByText('This is private therapist information.', { exact: true }).count(),
    0,
  );
  const shared = await api('/portal/notes', clientToken);
  assert.ok(!JSON.stringify(shared).includes('This is private therapist information.'));
  console.log('PASS browser and API: private/shared clinical documentation');
  await visible(therapistPage, therapistPage.getByText('Connected', { exact: true }));
  await visible(clientPage, clientPage.getByText('Connected', { exact: true }));
  await therapistPage.getByLabel('Message', { exact: true }).fill('Hello client in real time');
  await visible(clientPage, clientPage.getByText('Therapist is typing…', { exact: true }));
  await therapistPage.getByRole('button', { name: 'Send message' }).click();
  await visible(clientPage, clientPage.getByText('Hello client in real time', { exact: true }));
  await clientPage.getByLabel('Message', { exact: true }).fill('Hello therapist in real time');
  await clientPage.getByRole('button', { name: 'Send message' }).click();
  await visible(
    therapistPage,
    therapistPage.getByText('Hello therapist in real time', { exact: true }),
  );
  await visible(
    clientPage,
    clientPage.locator('.message-bubble.own small').filter({ hasText: 'Read' }),
  );
  await therapistPage.reload();
  await clientPage.reload();
  for (const page of [therapistPage, clientPage]) {
    await visible(page, page.getByText('Hello client in real time', { exact: true }));
    await visible(page, page.getByText('Hello therapist in real time', { exact: true }));
  }
  console.log(
    'PASS browser: two-way real-time chat, typing, read receipts and history after refresh',
  );
  await Session.create({
    therapist: account._id,
    client: client._id,
    contact: { name: client.name, email: client.email },
    duration: 60,
    start: new Date('2020-01-10T10:00:00Z'),
    end: new Date('2020-01-10T11:00:00Z'),
    status: 'confirmed',
  });
  const past = await Session.findOne({
    therapist: account._id,
    start: new Date('2020-01-10T10:00:00Z'),
  });
  await api(`/scheduling/sessions/${past.id}/no-show`, token, {}, 'POST');
  const completed = await Session.create({
    therapist: account._id,
    client: client._id,
    contact: { name: client.name, email: client.email },
    duration: 60,
    start: new Date('2020-01-11T10:00:00Z'),
    end: new Date('2020-01-11T11:00:00Z'),
    status: 'confirmed',
  });
  await api(`/scheduling/sessions/${completed.id}/complete`, token, {}, 'POST');
  await scheduleSessionEvents(new Date('2030-01-06T03:30:00Z'));
  await NotificationService.dispatchPending();
  await deliverNotifications();
  for (const kind of [
    'booking.confirmed',
    'payment.captured',
    'session.reminder',
    'session.followup',
  ])
    assert.ok(await DomainEvent.exists({ therapist: account._id, kind }));
  await clientPage.reload();
  await visible(clientPage, clientPage.getByText(/Stub queued; no WhatsApp message sent/).first());
  console.log('PASS browser/API: notification events and explicit WhatsApp stub status');
  await therapistPage.goto(`${origin}/analytics`);
  const today = new Date().toISOString().slice(0, 10),
    month = today.slice(0, 7);
  await therapistPage.getByLabel('From (UTC)').fill(`${month}-01`);
  const revenueResponse = therapistPage.waitForResponse(
    (response) =>
      response.url().includes('/api/analytics?') && response.url().includes(`to=${today}`),
  );
  await therapistPage.getByLabel('Through (UTC)').fill(today);
  assert.equal((await (await revenueResponse).json()).totals.revenuePaise, 150000);
  await visible(therapistPage, therapistPage.getByRole('cell', { name: month, exact: true }));
  await visible(therapistPage, therapistPage.getByText('₹1,500.00', { exact: true }).first());
  await therapistPage.screenshot({ path: `${artifacts}/revenue-trend.png`, fullPage: true });
  await therapistPage.getByLabel('Analytics depth').selectOption('advanced');
  await visible(
    therapistPage,
    therapistPage.getByRole('heading', { name: 'Advanced analytics requires subscription access' }),
  );
  await SubscriptionTierConfig.create({
    key: 'browser-limited',
    name: 'Browser limited',
    features: {
      crm: true,
      clients_add: true,
      note_freeform: true,
      note_soap: false,
      note_dap: false,
      analytics_basic: true,
      analytics_advanced: false,
      scheduling: true,
      payments: true,
    },
    caps: { clients: 1 },
  });
  await Therapist.updateOne(
    { _id: account._id },
    { $set: { subscriptionConfig: 'browser-limited' } },
  );
  await therapistPage.goto(`${origin}/clients/${client._id}`);
  await therapistPage.getByRole('combobox', { name: /Note format/ }).selectOption('soap');
  await therapistPage
    .getByRole('textbox', { name: /^Subjective/ })
    .fill('Unsaved draft retained on denial');
  await therapistPage.getByRole('button', { name: 'Save note' }).click();
  await visible(
    therapistPage,
    therapistPage.getByRole('heading', {
      name: 'SOAP note templates requires subscription access',
    }),
  );
  assert.equal(
    await therapistPage.getByRole('textbox', { name: /^Subjective/ }).inputValue(),
    'Unsaved draft retained on denial',
  );
  await SubscriptionTierConfig.updateOne(
    { key: 'browser-limited' },
    {
      $set: { 'features.note_soap': true, 'features.analytics_advanced': true, 'caps.clients': 2 },
    },
  );
  await therapistPage.getByRole('button', { name: 'Save note' }).click();
  await visible(
    therapistPage,
    therapistPage.getByText('Unsaved draft retained on denial', { exact: true }),
  );
  await therapistPage.goto(`${origin}/clients`);
  const addForm = therapistPage.locator('form').filter({ hasText: 'Add a client' });
  await addForm.getByLabel('Name', { exact: true }).fill('Another Browser Client');
  await addForm.getByLabel('Email', { exact: true }).fill('anotherbrowser@example.test');
  await addForm.getByRole('button', { name: 'Add client' }).click();
  await visible(therapistPage, therapistPage.getByRole('link', { name: 'Another Browser Client' }));
  await addForm.getByLabel('Name', { exact: true }).fill('Preserved Capacity Draft');
  await addForm.getByLabel('Email', { exact: true }).fill('capacitybrowser@example.test');
  await addForm.getByRole('button', { name: 'Add client' }).click();
  await visible(
    therapistPage,
    therapistPage.getByRole('heading', {
      name: 'More active clients requires subscription access',
    }),
  );
  assert.equal(
    await addForm.getByLabel('Name', { exact: true }).inputValue(),
    'Preserved Capacity Draft',
  );
  await therapistPage.goto(`${origin}/analytics`);
  await therapistPage.getByLabel('Analytics depth').selectOption('advanced');
  await therapistPage.getByLabel('From (UTC)').fill('2020-01-01');
  await therapistPage.getByLabel('Through (UTC)').fill('2020-01-31');
  await visible(therapistPage, therapistPage.getByText('50.0%', { exact: true }));
  await therapistPage.screenshot({ path: `${artifacts}/analytics.png`, fullPage: true });
  await therapistPage.goto(`${origin}/subscription`);
  await therapistPage
    .locator('article')
    .filter({ has: therapistPage.getByRole('heading', { name: 'Professional', exact: true }) })
    .getByRole('button', { name: 'Request this plan' })
    .click();
  await visible(therapistPage, therapistPage.getByText(/Upgrade request saved/));
  await therapistPage.goto(`${origin}/billing`);
  await visible(therapistPage, therapistPage.getByText('captured', { exact: true }));
  await clientPage.screenshot({ path: `${artifacts}/client-portal.png`, fullPage: true });
  await therapistPage.goto(`${origin}/clients/${client._id}`);
  await therapistPage.screenshot({ path: `${artifacts}/clinical-chat.png`, fullPage: true });
  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join('; ')}`);
  assert.equal(await Client.countDocuments({ therapist: account._id, status: 'active' }), 2);
  console.log(
    'PASS browser: aggregated Recharts analytics, three feature gates, draft preservation, live configuration changes, upgrade request and billing',
  );
  console.log(
    `PASS complete fixture end-to-end flow. Artifacts: ${artifacts}. No live Razorpay or external email was used.`,
  );
} catch (error) {
  if (therapistPage)
    await therapistPage
      .screenshot({ path: `${artifacts}/failure-therapist.png`, fullPage: true })
      .catch(() => {});
  if (clientPage)
    await clientPage
      .screenshot({ path: `${artifacts}/failure-client.png`, fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  if (io) await new Promise((resolve) => io.close(resolve));
  if (close) await close();
}
