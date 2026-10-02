import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { database } from './helpers.js';
import { app } from '../src/app.js';
import Therapist from '../src/models/Therapist.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-secret-never-used-in-production';
let close;
before(async () => {
  close = await database();
  await Therapist.init();
});
after(async () => {
  if (close) await close();
});
const credentials = {
  name: 'Dr Meera Sharma',
  email: 'meera@example.test',
  password: 'Safe-testing-password!',
};
export let token;
test('register persists bcrypt hash and rejects duplicate/invalid accounts', async () => {
  const result = await request(app).post('/api/auth/register').send(credentials).expect(201);
  assert.equal(result.body.therapist.password_hash, undefined);
  const record = await Therapist.findOne({ email: credentials.email }).select('+password_hash');
  assert.notEqual(record.password_hash, credentials.password);
  assert.ok(await bcrypt.compare(credentials.password, record.password_hash));
  await request(app).post('/api/auth/register').send(credentials).expect(409);
  await request(app)
    .post('/api/auth/register')
    .send({ email: 'invalid', password: 'short' })
    .expect(400);
});
test('JWT login and protected account access', async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ ...credentials, password: 'wrong' })
    .expect(401);
  const result = await request(app).post('/api/auth/login').send(credentials).expect(200);
  token = result.body.token;
  assert.ok(token);
  assert.equal(result.body.therapist.password_hash, undefined);
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid').expect(401);
  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(me.body.therapist.email, credentials.email);
});
test('profile updates are validated and protected; privileged fields ignored', async () => {
  await request(app).patch('/api/therapists/me').send({ bio: 'x' }).expect(401);
  const result = await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      bio: 'Compassionate, evidence-informed care.',
      specializations: ['Anxiety'],
      languages: ['English', 'Hindi'],
      services: [{ name: 'Individual therapy', duration: 60, rate: 150000 }],
      email: 'intruder@example.test',
    })
    .expect(200);
  assert.equal(result.body.therapist.email, credentials.email);
  assert.equal(result.body.therapist.bio, 'Compassionate, evidence-informed care.');
  await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ timezone: 'not/a-zone' })
    .expect(400);
});
test('branded slugs are unique and reserved paths cannot be claimed', async () => {
  const first = await Therapist.findOne({ email: credentials.email });
  assert.equal(first.slug, 'dr-meera-sharma');
  const second = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, email: 'second@example.test' })
    .expect(201);
  assert.notEqual(second.body.therapist.slug, first.slug);
  await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ slug: second.body.therapist.slug })
    .expect(409);
  await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ slug: 'dashboard' })
    .expect(400);
});
test('public profile exposes only explicitly shared fields', async () => {
  const { body } = await request(app).get('/api/public/dr-meera-sharma').expect(200);
  assert.equal(body.therapist.name, credentials.name);
  assert.equal(body.therapist.email, undefined);
  assert.equal(body.therapist.password_hash, undefined);
  assert.equal(body.therapist.subscriptionConfig, undefined);
  await request(app).get('/api/public/unknown').expect(404);
});
test('branded HTML includes escaped Open Graph metadata before JavaScript executes', async () => {
  const result = await request(app).get('/dr-meera-sharma').expect(200);
  assert.match(result.text, /<meta property="og:title" content="Dr Meera Sharma \| Unfazed"/);
  assert.match(result.text, /og:url/);
  const access = await request(app)
    .get('/api/therapists/entitlements')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(access.body.features.scheduling, true);
});
test('recurring weekly availability converts India times to UTC', async () => {
  await request(app)
    .put('/api/scheduling/availability/weekly')
    .set('Authorization', `Bearer ${token}`)
    .send({
      timezone: 'Asia/Kolkata',
      weekly: [{ day: 1, windows: [{ start: '09:00', end: '17:00' }] }],
    })
    .expect(200);
  const { body } = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  assert.ok(body.slots.length);
  assert.equal(body.slots[0].start, '2030-01-07T03:30:00.000Z');
  await request(app)
    .put('/api/scheduling/availability/weekly')
    .set('Authorization', `Bearer ${token}`)
    .send({ weekly: [{ day: 1, windows: [{ start: '17:00', end: '09:00' }] }] })
    .expect(400);
  await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-01&to=2031-01-01&duration=60')
    .expect(400);
});
test('one-time overrides replace recurring hours and blocked intervals disappear', async () => {
  await request(app)
    .put('/api/scheduling/availability/exceptions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      overrides: [
        { date: '2030-01-08', blocked: false, windows: [{ start: '10:00', end: '12:00' }] },
        { date: '2030-01-14', blocked: true, windows: [] },
      ],
      blocked: [{ start: '2030-01-07T03:30:00Z', end: '2030-01-07T04:30:00Z' }],
    })
    .expect(200);
  const override = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-08&to=2030-01-08&duration=60')
    .expect(200);
  assert.equal(override.body.slots[0].start, '2030-01-08T04:30:00.000Z');
  const blocked = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-14&to=2030-01-14&duration=60')
    .expect(200);
  assert.equal(blocked.body.slots.length, 0);
  const partial = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  assert.ok(partial.body.slots.every((s) => s.start >= '2030-01-07T04:30:00.000Z'));
});
test('all session durations and configured buffer fit inside availability windows', async () => {
  for (const duration of [30, 45, 60, 90]) {
    const { body } = await request(app)
      .get(`/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=${duration}`)
      .expect(200);
    assert.ok(body.slots.length);
    assert.equal((new Date(body.slots[0].end) - new Date(body.slots[0].start)) / 60000, duration);
  }
  await request(app)
    .put('/api/scheduling/availability/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ durations: [30, 60], bufferMinutes: 30 })
    .expect(200);
  const disabled = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=45')
    .expect(200);
  assert.equal(disabled.body.slots.length, 0);
  const enabled = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  assert.ok(
    enabled.body.slots.every(
      (s) => new Date(s.end).getTime() + 30 * 60000 <= new Date('2030-01-07T11:30:00Z').getTime(),
    ),
  );
  await request(app)
    .put('/api/scheduling/availability/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ durations: [30, 45, 60, 90], bufferMinutes: 10 })
    .expect(200);
});
let bookingId, bookingToken, bookedStart;
test('booking persists session and instantly removes occupied times', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const before = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  bookedStart = before.body.slots[0].start;
  const { body } = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: bookedStart,
      name: 'Ananya Rao',
      email: 'ananya@example.test',
    })
    .expect(201);
  bookingId = body.session._id;
  bookingToken = body.bookingToken;
  assert.equal(body.session.status, 'pending_payment');
  assert.ok(bookingToken);
  const after = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  assert.ok(!after.body.slots.some((s) => s.start === bookedStart));
  await request(app).get('/api/scheduling/sessions').expect(401);
  const list = await request(app)
    .get('/api/scheduling/sessions')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(list.body.sessions[0]._id, bookingId);
});
test('concurrent booking requests cannot double book or bypass buffers', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const slots = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-21&to=2030-01-21&duration=60')
    .expect(200);
  const payload = {
    serviceId: therapist.services[0].id,
    start: slots.body.slots[0].start,
    name: 'Race Client',
    email: 'race@example.test',
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request(app).post('/api/public/dr-meera-sharma/book').send(payload),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);
  await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      ...payload,
      start: new Date(new Date(payload.start).getTime() + 60 * 60000).toISOString(),
    })
    .expect(409);
  await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({ ...payload, start: '2030-01-21T02:30:00Z' })
    .expect(409);
});
import NotificationJob from '../src/models/NotificationJob.js';
test('booking capability is scoped; cancellation persists waitlist notification stub', async () => {
  await request(app).get(`/api/bookings/${bookingId}`).expect(401);
  await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${bookingToken}`)
    .expect(200);
  await request(app)
    .post('/api/public/dr-meera-sharma/waitlist')
    .send({
      date: '2030-01-07',
      duration: 60,
      name: 'Waiting Client',
      email: 'waiting@example.test',
    })
    .expect(201);
  await request(app)
    .post(`/api/scheduling/sessions/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  await request(app)
    .post(`/api/scheduling/sessions/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(await NotificationJob.countDocuments({ kind: 'slot_available' }), 1);
  const jobs = await NotificationJob.find();
  assert.equal(jobs[0].status, 'stubbed');
  const slots = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-01-07&to=2030-01-07&duration=60')
    .expect(200);
  assert.ok(slots.body.slots.some((s) => s.start === bookedStart));
});
import Client from '../src/models/Client.js';
let clientId;
test('client CRUD persists tenant-owned records and archives instead of deleting', async () => {
  const auth = { Authorization: `Bearer ${token}` };
  const created = await request(app)
    .post('/api/clients')
    .set(auth)
    .send({ name: 'Ananya Rao', email: 'ananya@example.test', tags: [{ label: 'Online' }] })
    .expect(201);
  clientId = created.body.client._id;
  await request(app).get(`/api/clients/${clientId}`).expect(401);
  const second = await request(app)
    .post('/api/auth/login')
    .send({ ...credentials, email: 'second@example.test' })
    .expect(200);
  await request(app)
    .get(`/api/clients/${clientId}`)
    .set('Authorization', `Bearer ${second.body.token}`)
    .expect(404);
  await request(app)
    .patch(`/api/clients/${clientId}`)
    .set(auth)
    .send({ name: 'Ananya R', therapist: second.body.therapist._id })
    .expect(200);
  const client = await Client.findById(clientId);
  assert.equal(
    String(client.therapist),
    (await Therapist.findOne({ email: credentials.email })).id,
  );
  await request(app).delete(`/api/clients/${clientId}`).set(auth).expect(200);
  assert.equal((await Client.findById(clientId)).status, 'archived');
  await request(app)
    .patch(`/api/clients/${clientId}`)
    .set(auth)
    .send({ name: 'Ananya Rao', status: 'active' })
    .expect(200);
});
test('client sorting, filtering and pagination are tenant-scoped and bounded', async () => {
  const auth = { Authorization: `Bearer ${token}` };
  await request(app)
    .post('/api/clients')
    .set(auth)
    .send({
      name: 'Zoya Khan',
      email: 'zoya@example.test',
      status: 'inactive',
      tags: [{ label: 'In person' }],
    })
    .expect(201);
  const filtered = await request(app)
    .get('/api/clients?status=active&tag=Online&search=Ananya')
    .set(auth)
    .expect(200);
  assert.equal(filtered.body.total, 1);
  assert.equal(filtered.body.clients[0]._id, clientId);
  const sorted = await request(app)
    .get('/api/clients?sort=name&direction=desc&limit=1')
    .set(auth)
    .expect(200);
  assert.equal(sorted.body.clients[0].name, 'Zoya Khan');
  await request(app).get('/api/clients?limit=10000').set(auth).expect(400);
});
import Session from '../src/models/Session.js';
test('client history and last-session sorting use the owned client reference', async () => {
  const client = await Client.findById(clientId);
  await Session.create({
    therapist: client.therapist,
    client: client.id,
    contact: { name: client.name, email: client.email },
    start: new Date('2020-01-01T04:30:00Z'),
    end: new Date('2020-01-01T05:30:00Z'),
    duration: 60,
    status: 'completed',
  });
  const history = await request(app)
    .get(`/api/clients/${clientId}/history`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(history.body.sessions.length, 1);
  const list = await request(app)
    .get('/api/clients?sort=lastSession&direction=desc')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(list.body.clients[0]._id, clientId);
  assert.ok(list.body.clients[0].lastSession);
  assert.equal(list.body.clients[0].intake, undefined);
});
import SessionNote from '../src/models/SessionNote.js';
import { clientHistory } from '../src/services/clientHistoryService.js';
test('CRM aggregates payment and notes history with an API-level private/shared boundary', async () => {
  const client = await Client.findById(clientId);
  await SessionNote.create({
    therapist: client.therapist,
    client: client.id,
    privateContent: 'Private clinical test fixture',
    sharedContent: 'Shared reflection fixture',
  });
  await SessionNote.create({
    therapist: client.therapist,
    client: client.id,
    privateContent: 'Private-only fixture',
  });
  const { body } = await request(app)
    .get(`/api/clients/${clientId}/history`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(body.notes.length, 2);
  assert.ok(body.notes.some((n) => n.privateContent));
  assert.deepEqual(body.payments, []);
  const shared = await clientHistory(client, { sharedOnly: true });
  assert.equal(shared.notes.length, 1);
  assert.equal(shared.notes[0].privateContent, undefined);
});
import { issueToken } from '../src/services/tokenService.js';
let clientToken;
const intake = {
  consent: { accepted: true, version: 'consent-v1' },
  demographics: { age: 29, pronouns: 'she/her', location: 'Bengaluru', occupation: 'Designer' },
  presentingConcern: 'Looking for support with work stress.',
  history: { priorTherapy: 'None', medicalHistory: 'None reported', medications: 'None' },
};
test('static intake persists in the database only through scoped portal authentication', async () => {
  const client = await Client.findById(clientId);
  clientToken = issueToken(client.id, 'client', { therapistId: String(client.therapist) });
  await request(app).post('/api/portal/intake').send(intake).expect(401);
  await request(app)
    .post('/api/portal/intake')
    .set('Authorization', `Bearer ${token}`)
    .send(intake)
    .expect(403);
  await request(app)
    .post('/api/portal/intake')
    .set('Authorization', `Bearer ${clientToken}`)
    .send(intake)
    .expect(200);
  const persisted = await Client.findById(clientId).select('+intake');
  assert.equal(persisted.intake.presentingConcern, intake.presentingConcern);
  assert.ok(persisted.intake.submittedAt);
});
import ConsentAudit from '../src/models/ConsentAudit.js';
test('consent requires a literal checkbox, current version and immutable server audit timestamp', async () => {
  const auth = { Authorization: `Bearer ${clientToken}` };
  await request(app)
    .post('/api/portal/intake')
    .set(auth)
    .send({ ...intake, consent: { accepted: false, version: 'consent-v1' } })
    .expect(400);
  await request(app)
    .post('/api/portal/intake')
    .set(auth)
    .send({ ...intake, consent: { accepted: 'true', version: 'consent-v1' } })
    .expect(400);
  await request(app)
    .post('/api/portal/intake')
    .set(auth)
    .send({ ...intake, consent: { accepted: true, version: 'old' } })
    .expect(400);
  const audit = await ConsentAudit.findOne({ client: clientId });
  assert.ok(audit.acceptedAt);
  assert.ok(audit.text);
  const original = audit.acceptedAt.toISOString();
  await request(app)
    .post('/api/portal/intake')
    .set(auth)
    .send({ ...intake, consentAt: '1990-01-01' })
    .expect(200);
  assert.equal(
    (await ConsentAudit.findOne({ client: clientId })).acceptedAt.toISOString(),
    original,
  );
  assert.equal(await ConsentAudit.countDocuments({ client: clientId }), 1);
  const profile = await request(app)
    .get(`/api/clients/${clientId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(profile.body.consentAudit.length, 1);
  assert.equal(profile.body.client.consentAt, original);
});
test('client portal exposes shared notes only and therapist issues scoped links', async () => {
  const { body } = await request(app)
    .post(`/api/clients/${clientId}/portal-link`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.match(body.url, /\/portal#access=/);
  const history = await request(app)
    .get('/api/portal/history')
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(200);
  assert.equal(history.body.notes.length, 1);
  assert.equal(history.body.notes[0].privateContent, undefined);
  await request(app).get('/api/clients').set('Authorization', `Bearer ${clientToken}`).expect(403);
});
test('new booking completes intake/consent; email alone never grants existing client history', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const booked = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: '2030-01-28T03:30:00Z',
      name: 'New Client',
      email: 'newclient@example.test',
    })
    .expect(201);
  const { body } = await request(app)
    .post(`/api/bookings/${booked.body.session._id}/intake`)
    .set('Authorization', `Bearer ${booked.body.bookingToken}`)
    .send(intake)
    .expect(200);
  assert.ok(body.token);
  assert.equal(
    (await Session.findById(booked.body.session._id)).client.toString(),
    body.client._id,
  );
  const existing = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: '2030-02-04T03:30:00Z',
      name: 'Impersonator',
      email: 'ananya@example.test',
    })
    .expect(201);
  await request(app)
    .post(`/api/bookings/${existing.body.session._id}/intake`)
    .set('Authorization', `Bearer ${existing.body.bookingToken}`)
    .send(intake)
    .expect(409);
});
import Payment from '../src/models/Payment.js';
import { matchesSignature } from '../src/services/paymentGateway.js';
let paymentId, paidSessionId, paidBookingToken;
const gatewayPayments = new Map();
let orderCalls = 0;
const fixtureGateway = {
  publicKey: () => 'rzp_test_fixture',
  createOrder: async (data) => {
    orderCalls++;
    return { id: `order_fixture_${orderCalls}`, amount: data.amount, currency: data.currency };
  },
  fetchPayment: async (id) => gatewayPayments.get(id),
  verifyCheckout: (order, payment, signature) =>
    matchesSignature(`${order}|${payment}`, signature, 'checkout-fixture-secret'),
  verifyWebhook: (raw, signature) => matchesSignature(raw, signature, 'webhook-fixture-secret'),
};
test('session payment amount is server-derived, consent-gated and reuses its order', async () => {
  // This is an explicitly injected integration-test gateway, never a live success.
  app.locals.paymentGateway = fixtureGateway;
  const therapist = await Therapist.findOne({ email: credentials.email });
  const booked = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: '2030-02-11T03:30:00Z',
      name: 'Paying Client',
      email: 'paying@example.test',
    })
    .expect(201);
  paidSessionId = booked.body.session._id;
  paidBookingToken = booked.body.bookingToken;
  await request(app)
    .post(`/api/payments/session/${paidSessionId}/orders`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .expect(409);
  await request(app)
    .post(`/api/bookings/${paidSessionId}/intake`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .send(intake)
    .expect(200);
  const order = await request(app)
    .post(`/api/payments/session/${paidSessionId}/orders`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .send({ amount: 1 })
    .expect(201);
  paymentId = order.body.payment._id;
  assert.equal(order.body.payment.amount, 150000);
  assert.ok(order.body.payment.gateway_order_id);
  assert.equal(order.body.key, 'rzp_test_fixture');
  const again = await request(app)
    .post(`/api/payments/session/${paidSessionId}/orders`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .expect(201);
  assert.equal(again.body.payment.gateway_order_id, order.body.payment.gateway_order_id);
  assert.equal(orderCalls, 1);
  assert.equal((await Payment.findById(paymentId)).amount, 150000);
  await request(app)
    .get(`/api/payments/${paymentId}`)
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(403);
});
import { createHmac } from 'node:crypto';
test('callback signature and gateway details are verified but do not confirm the booking', async () => {
  const payment = await Payment.findById(paymentId);
  const gatewayId = 'pay_fixture_session';
  gatewayPayments.set(gatewayId, {
    id: gatewayId,
    order_id: payment.gateway_order_id,
    amount: payment.amount,
    currency: 'INR',
    status: 'captured',
  });
  const payload = {
    razorpay_order_id: payment.gateway_order_id,
    razorpay_payment_id: gatewayId,
    razorpay_signature: createHmac('sha256', 'checkout-fixture-secret')
      .update(`${payment.gateway_order_id}|${gatewayId}`)
      .digest('hex'),
  };
  await request(app)
    .post(`/api/payments/${paymentId}/verify`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .send({ ...payload, razorpay_signature: '0'.repeat(64) })
    .expect(400);
  const { body } = await request(app)
    .post(`/api/payments/${paymentId}/verify`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .send(payload)
    .expect(200);
  assert.equal(body.payment.status, 'verified');
  assert.equal((await Session.findById(paidSessionId)).status, 'pending_payment');
  assert.notEqual((await Session.findById(paidSessionId)).paymentStatus, 'paid');
  const dashboard = await request(app)
    .get('/api/payments')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.payments[0].status, 'verified');
});
import Package from '../src/models/Package.js';
const packagePayments = [];
test('3, 6 and 12 session packages persist and purchase prices cannot be client-tampered', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  for (const sessionCount of [3, 6, 12]) {
    const created = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${sessionCount} sessions`,
        serviceId: therapist.services[0].id,
        sessionCount,
        amount: sessionCount * 140000,
        expiryDays: 90,
      })
      .expect(201);
    const purchased = await request(app)
      .post(`/api/packages/${created.body.package._id}/orders`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ idempotencyKey: crypto.randomUUID(), amount: 1 })
      .expect(201);
    assert.equal(purchased.body.payment.amount, sessionCount * 140000);
    assert.equal(purchased.body.payment.packageSnapshot.sessionCount, sessionCount);
    packagePayments.push(purchased.body.payment._id);
  }
  assert.equal(await Package.countDocuments(), 3);
  await request(app)
    .post('/api/packages')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Invalid package',
      serviceId: therapist.services[0].id,
      sessionCount: 5,
      amount: 1,
    })
    .expect(400);
});
import ClientPackage from '../src/models/ClientPackage.js';
import { activatePackage } from '../src/services/packageService.js';
test('package rate, expiry and credits are immutable snapshots; redemption is atomic', async () => {
  // Explicit captured database fixture to exercise credits before webhook integration.
  const snapshot = await Payment.findById(packagePayments[0]);
  const fixture = await Payment.create({
    therapist: snapshot.therapist,
    client: snapshot.client,
    package: snapshot.package,
    purchaseKey: 'captured-package-fixture',
    amount: 420001,
    platform_fee: 0,
    net_amount: 420001,
    subtotal: 420001,
    packageSnapshot: { ...snapshot.packageSnapshot, amount: 420001 },
    status: 'captured',
    capturedAt: new Date('2030-01-01T00:00:00Z'),
  });
  const pkg = await activatePackage(fixture);
  assert.equal(pkg.baseRate, 140000);
  assert.equal(pkg.rateRemainder, 1);
  assert.equal(pkg.expiresAt.toISOString(), '2030-04-01T00:00:00.000Z');
  const repeated = await activatePackage(fixture);
  assert.equal(repeated.id, pkg.id);
  const payload = {
    serviceId: String(pkg.serviceId),
    clientPackage: pkg.id,
    start: '2030-02-18T03:30:00Z',
  };
  const results = await Promise.all([
    request(app)
      .post('/api/portal/book')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload),
    request(app)
      .post('/api/portal/book')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload),
  ]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  const booked = results.find((r) => r.status === 201).body.session;
  assert.equal(booked.paymentStatus, 'package');
  assert.equal(booked.rate, 140001);
  assert.equal((await ClientPackage.findById(pkg.id)).usedSessions.length, 1);
  await request(app)
    .post('/api/portal/book')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ ...payload, start: '2030-04-08T03:30:00Z' })
    .expect(409);
  await request(app)
    .post(`/api/scheduling/sessions/${booked._id}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal((await ClientPackage.findById(pkg.id)).usedSessions.length, 0);
});
import { expireReservations } from '../src/services/reservationService.js';
import SubscriptionTierConfig from '../src/models/SubscriptionTierConfig.js';
function signedEvent(event) {
  const raw = JSON.stringify(event);
  return {
    raw,
    signature: createHmac('sha256', 'webhook-fixture-secret').update(raw).digest('hex'),
  };
}
async function sendEvent(event, id = 'fixture-event') {
  const { raw, signature } = signedEvent(event);
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .set('x-razorpay-event-id', id)
    .send(raw);
}
test('signed captured webhook confirms session, generates stored PDF, and is idempotent', async () => {
  const payment = await Payment.findById(paymentId);
  const entity = {
    id: 'pay_fixture_session',
    order_id: payment.gateway_order_id,
    amount: payment.amount,
    currency: 'INR',
    status: 'captured',
  };
  const event = { event: 'payment.captured', payload: { payment: { entity } } };
  await request(app)
    .post('/api/payments/webhook')
    .set('x-razorpay-signature', '0'.repeat(64))
    .send(event)
    .expect(400);
  assert.equal((await sendEvent(event, 'session-captured')).status, 200);
  assert.equal((await sendEvent(event, 'session-captured')).status, 200);
  assert.equal((await sendEvent(event, 'session-captured-again')).status, 200);
  const confirmed = await Session.findById(paidSessionId);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.paymentStatus, 'paid');
  assert.equal(confirmed.holdExpiresAt, undefined);
  const stored = await Payment.findById(paymentId).select('+invoicePdf');
  assert.equal(stored.status, 'captured');
  assert.ok(stored.invoiceNumber);
  assert.equal(stored.invoicePdf.subarray(0, 4).toString(), '%PDF');
  const invoice = await request(app)
    .get(`/api/payments/${paymentId}/invoice`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .expect(200);
  assert.match(invoice.headers['content-type'], /application\/pdf/);
  await request(app)
    .get(`/api/payments/${paymentId}/invoice`)
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(403);
  const dashboard = await request(app)
    .get('/api/payments')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.payments.find((p) => p._id === paymentId).status, 'captured');
  assert.equal(dashboard.body.payments.find((p) => p._id === paymentId).invoicePdf, undefined);
});
test('webhook activates all package counts once and later failure events cannot downgrade capture', async () => {
  for (const [i, id] of packagePayments.entries()) {
    const payment = await Payment.findById(id),
      entity = {
        id: `pay_fixture_package_${i}`,
        order_id: payment.gateway_order_id,
        amount: payment.amount,
        currency: 'INR',
        status: 'captured',
      };
    const event = { event: 'payment.captured', payload: { payment: { entity } } };
    assert.equal((await sendEvent(event, `package-${i}`)).status, 200);
    assert.equal((await sendEvent(event, `package-${i}`)).status, 200);
    const pkg = await ClientPackage.findOne({ payment: id });
    assert.ok(pkg);
    assert.equal(pkg.sessionCount, [3, 6, 12][i]);
    assert.equal(pkg.perSessionRate, 140000);
    assert.equal(pkg.usedSessions.length, 0);
    assert.ok(pkg.expiresAt > new Date());
    assert.equal(await ClientPackage.countDocuments({ payment: id }), 1);
    assert.equal(
      (
        await sendEvent(
          {
            event: 'payment.failed',
            payload: { payment: { entity: { ...entity, status: 'failed' } } },
          },
          `late-failure-${i}`,
        )
      ).status,
      200,
    );
    assert.equal((await Payment.findById(id)).status, 'captured');
  }
});
test('webhook rejects wrong amounts and modified raw bodies', async () => {
  const payment = await Payment.findById(paymentId);
  assert.equal(
    (
      await sendEvent(
        {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_mismatch',
                order_id: payment.gateway_order_id,
                amount: 1,
                currency: 'INR',
                status: 'captured',
              },
            },
          },
        },
        'mismatch',
      )
    ).status,
    400,
  );
  const event = { event: 'payment.captured' },
    signed = signedEvent(event);
  await request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signed.signature)
    .send(`${signed.raw} `)
    .expect(400);
});
test('failed payment status persists and reservations release; late captures require refund review', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const booked = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: '2030-02-25T03:30:00Z',
      name: 'Failure Client',
      email: 'failure@example.test',
    })
    .expect(201);
  const auth = { Authorization: `Bearer ${booked.body.bookingToken}` };
  await request(app)
    .post(`/api/bookings/${booked.body.session._id}/intake`)
    .set(auth)
    .send(intake)
    .expect(200);
  const created = await request(app)
      .post(`/api/payments/session/${booked.body.session._id}/orders`)
      .set(auth)
      .expect(201),
    payment = created.body.payment;
  const entity = {
    id: 'pay_fixture_failure',
    order_id: payment.gateway_order_id,
    amount: payment.amount,
    currency: 'INR',
    status: 'failed',
  };
  assert.equal(
    (
      await sendEvent(
        { event: 'payment.failed', payload: { payment: { entity } } },
        'failure-event',
      )
    ).status,
    200,
  );
  assert.equal((await Payment.findById(payment._id)).status, 'failed');
  await Session.updateOne(
    { _id: booked.body.session._id },
    { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
  );
  await expireReservations();
  assert.equal((await Session.findById(booked.body.session._id)).status, 'cancelled');
  assert.equal(
    (
      await sendEvent(
        {
          event: 'payment.captured',
          payload: { payment: { entity: { ...entity, status: 'captured' } } },
        },
        'late-capture',
      )
    ).status,
    200,
  );
  assert.equal((await Payment.findById(payment._id)).status, 'refund_required');
  assert.equal((await Session.findById(booked.body.session._id)).status, 'cancelled');
  const slots = await request(app)
    .get('/api/public/dr-meera-sharma/slots?from=2030-02-25&to=2030-02-25&duration=60')
    .expect(200);
  assert.ok(slots.body.slots.some((s) => s.start === '2030-02-25T03:30:00.000Z'));
});
test('entitlement configuration actually gates APIs without tier checks in routes', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  await SubscriptionTierConfig.create({
    key: 'limited-fixture',
    features: { crm: false, scheduling: false, payments: false, packages: false },
    caps: { clients: 0 },
  });
  await Therapist.updateOne(
    { _id: therapist.id },
    { $set: { subscriptionConfig: 'limited-fixture' } },
  );
  await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`).expect(403);
  await request(app)
    .get('/api/scheduling/availability')
    .set('Authorization', `Bearer ${token}`)
    .expect(403);
  await request(app)
    .get('/api/portal/me')
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(403);
  await Therapist.updateOne(
    { _id: therapist.id },
    { $set: { subscriptionConfig: 'missing-configuration' } },
  );
  await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`).expect(403);
  await Therapist.updateOne({ _id: therapist.id }, { $set: { subscriptionConfig: 'default' } });
});
test('package credits cannot be overdrawn or spent by another client', async () => {
  const pkg = await ClientPackage.findOne({ payment: packagePayments[0] });
  await ClientPackage.updateOne({ _id: pkg.id }, { $set: { expiresAt: new Date('2030-12-31') } });
  for (const date of ['2030-03-04', '2030-03-11', '2030-03-18'])
    await request(app)
      .post('/api/portal/book')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ serviceId: String(pkg.serviceId), clientPackage: pkg.id, start: `${date}T03:30:00Z` })
      .expect(201);
  await request(app)
    .post('/api/portal/book')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      serviceId: String(pkg.serviceId),
      clientPackage: pkg.id,
      start: '2030-03-25T03:30:00Z',
    })
    .expect(409);
  assert.equal((await ClientPackage.findById(pkg.id)).usedSessions.length, 3);
  const other = await Client.findOne({ email: 'newclient@example.test' }),
    otherToken = issueToken(other.id, 'client', { therapistId: String(other.therapist) });
  await request(app)
    .post('/api/portal/book')
    .set('Authorization', `Bearer ${otherToken}`)
    .send({
      serviceId: String(pkg.serviceId),
      clientPackage: pkg.id,
      start: '2030-03-25T03:30:00Z',
    })
    .expect(400);
  const six = await ClientPackage.findOne({ payment: packagePayments[1] });
  await ClientPackage.updateOne(
    { _id: six.id },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await request(app)
    .post('/api/portal/book')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      serviceId: String(six.serviceId),
      clientPackage: six.id,
      start: '2030-03-25T03:30:00Z',
    })
    .expect(409);
});
test('gateway outage is not a fabricated success and ambiguous order creation cannot be retried blindly', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const booked = await request(app)
    .post('/api/portal/book')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ serviceId: therapist.services[0].id, start: '2030-04-15T03:30:00Z' })
    .expect(201);
  app.locals.paymentGateway = {
    ...fixtureGateway,
    createOrder: async () => {
      throw new Error('Fixture outage');
    },
  };
  await request(app)
    .post(`/api/payments/session/${booked.body.session._id}/orders`)
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(502);
  const payment = await Payment.findOne({ session: booked.body.session._id });
  assert.equal(payment.status, 'order_error');
  assert.equal(payment.gateway_order_id, undefined);
  await request(app)
    .post(`/api/payments/session/${booked.body.session._id}/orders`)
    .set('Authorization', `Bearer ${clientToken}`)
    .expect(409);
  app.locals.paymentGateway = fixtureGateway;
});
test('paid cancellation flags refund review while preserving financial history', async () => {
  await request(app)
    .post(`/api/scheduling/sessions/${paidSessionId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal((await Payment.findById(paymentId)).status, 'refund_required');
  assert.equal((await Session.findById(paidSessionId)).paymentStatus, 'refund_required');
  await request(app)
    .get(`/api/payments/${paymentId}/invoice`)
    .set('Authorization', `Bearer ${paidBookingToken}`)
    .expect(200);
});
test('API readiness confirms a real MongoDB connection and unknown API routes return JSON', async () => {
  const ready = await request(app).get('/api/ready').expect(200);
  assert.equal(ready.body.database, 'connected');
  const unknown = await request(app).get('/api/does-not-exist').expect(404);
  assert.equal(unknown.body.message, 'Endpoint not found');
});
import { seed } from '../scripts/seed.js';
test('configured client capacity is enforced under concurrent creation and restoration', async () => {
  const registered = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, name: 'Dr Capacity Fixture', email: 'capacity@example.test' })
      .expect(201),
    therapistId = registered.body.therapist._id,
    auth = { Authorization: `Bearer ${registered.body.token}` };
  await SubscriptionTierConfig.create({
    key: 'capacity-fixture',
    features: { crm: true },
    caps: { clients: 1 },
  });
  await Therapist.updateOne(
    { _id: therapistId },
    { $set: { subscriptionConfig: 'capacity-fixture' } },
  );
  const results = await Promise.all(
    [0, 1, 2].map((i) =>
      request(app)
        .post('/api/clients')
        .set(auth)
        .send({ name: `Capacity Client ${i}`, email: `capacity${i}@example.test` }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 403).length, 2);
  const archived = results.find((r) => r.status === 201).body.client._id;
  await request(app).delete(`/api/clients/${archived}`).set(auth).expect(200);
  await request(app)
    .post('/api/clients')
    .set(auth)
    .send({ name: 'New capacity client', email: 'newcapacity@example.test' })
    .expect(201);
  await request(app)
    .patch(`/api/clients/${archived}`)
    .set(auth)
    .send({ status: 'active' })
    .expect(403);
});
test('development seed is repeatable and preserves pre-existing records and sessions', async () => {
  process.env.SEED_DATABASE_ALLOW = 'true';
  process.env.SEED_PASSWORD = 'Seed-development-fixture-only!';
  const existing = await Therapist.findOne({ email: credentials.email }).select('+password_hash'),
    hash = existing.password_hash;
  await seed();
  const counts = await Promise.all([
    Therapist.countDocuments(),
    Client.countDocuments(),
    Session.countDocuments(),
    Package.countDocuments(),
  ]);
  await seed();
  assert.deepEqual(
    await Promise.all([
      Therapist.countDocuments(),
      Client.countDocuments(),
      Session.countDocuments(),
      Package.countDocuments(),
    ]),
    counts,
  );
  assert.equal(
    (await Therapist.findById(existing.id).select('+password_hash')).password_hash,
    hash,
  );
  assert.equal((await Therapist.findById(existing.id)).bio, existing.bio);
  const fixtureTherapist = await Therapist.findOne({ email: 'meera@unfazed.example' });
  assert.notEqual(fixtureTherapist.slug, existing.slug);
  assert.equal(await Client.countDocuments({ therapist: fixtureTherapist.id }), 3);
  delete process.env.SEED_DATABASE_ALLOW;
  delete process.env.SEED_PASSWORD;
});
import { createServer } from 'node:http';
import { io as connectSocket } from 'socket.io-client';
import { attachSchedulingSocket } from '../src/sockets/schedulingSocket.js';
test('Socket.io invalidates slots immediately without broadcasting client or clinical data', async () => {
  const server = createServer(app),
    socketServer = attachSchedulingSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const socket = connectSocket(`http://127.0.0.1:${server.address().port}`, {
    transports: ['websocket'],
    reconnection: false,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    const watched = await socket.timeout(3000).emitWithAck('watch-availability', 'dr-meera-sharma');
    assert.equal(watched.watching, true);
    const invalidated = new Promise((resolve) =>
      socket.once('availability-changed', (...args) => resolve(args)),
    );
    const therapist = await Therapist.findOne({ email: credentials.email });
    await request(app)
      .post('/api/public/dr-meera-sharma/book')
      .send({
        serviceId: therapist.services[0].id,
        start: '2030-05-06T03:30:00Z',
        name: 'Socket Fixture',
        email: 'socket@example.test',
      })
      .expect(201);
    assert.deepEqual(await invalidated, []);
  } finally {
    socket.disconnect();
    await new Promise((resolve) => socketServer.close(resolve));
  }
});
test('a delayed failure callback cannot overwrite a concurrent webhook capture', async () => {
  const therapist = await Therapist.findOne({ email: credentials.email });
  const booked = await request(app)
    .post('/api/public/dr-meera-sharma/book')
    .send({
      serviceId: therapist.services[0].id,
      start: '2030-05-13T03:30:00Z',
      name: 'Callback Race Fixture',
      email: 'callbackrace@example.test',
    })
    .expect(201);
  const auth = { Authorization: `Bearer ${booked.body.bookingToken}` };
  await request(app)
    .post(`/api/bookings/${booked.body.session._id}/intake`)
    .set(auth)
    .send(intake)
    .expect(200);
  const created = await request(app)
      .post(`/api/payments/session/${booked.body.session._id}/orders`)
      .set(auth)
      .expect(201),
    payment = created.body.payment;
  let enter, release;
  const entered = new Promise((resolve) => {
      enter = resolve;
    }),
    delayed = new Promise((resolve) => {
      release = resolve;
    });
  app.locals.paymentGateway = {
    ...fixtureGateway,
    fetchPayment: async () => {
      enter();
      return delayed;
    },
  };
  try {
    const failureId = 'pay_fixture_delayed_failure',
      signature = createHmac('sha256', 'checkout-fixture-secret')
        .update(`${payment.gateway_order_id}|${failureId}`)
        .digest('hex');
    const verifying = request(app)
      .post(`/api/payments/${payment._id}/verify`)
      .set(auth)
      .send({
        razorpay_order_id: payment.gateway_order_id,
        razorpay_payment_id: failureId,
        razorpay_signature: signature,
      })
      .then((response) => response);
    await entered;
    const capture = {
      id: 'pay_fixture_race_captured',
      order_id: payment.gateway_order_id,
      amount: payment.amount,
      currency: 'INR',
      status: 'captured',
    };
    assert.equal(
      (
        await sendEvent(
          { event: 'payment.captured', payload: { payment: { entity: capture } } },
          'callback-race-capture',
        )
      ).status,
      200,
    );
    release({ ...capture, id: failureId, status: 'failed' });
    const result = await verifying;
    assert.equal(result.status, 200);
    assert.equal(result.body.payment.status, 'captured');
    assert.equal((await Payment.findById(payment._id)).status, 'captured');
    assert.equal((await Session.findById(booked.body.session._id)).paymentStatus, 'paid');
  } finally {
    app.locals.paymentGateway = fixtureGateway;
  }
});
test('profile editing cannot remove services referenced by appointments or paid packages', async () => {
  await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ services: [] })
    .expect(409);
  const therapist = await Therapist.findOne({ email: credentials.email });
  assert.equal(therapist.services.length, 1);
  const offer = await Package.findOne({ therapist: therapist.id });
  const creditsBefore = await ClientPackage.countDocuments({ package: offer.id });
  await request(app)
    .delete(`/api/packages/${offer.id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal((await Package.findById(offer.id)).active, false);
  assert.equal(await ClientPackage.countDocuments({ package: offer.id }), creditsBefore);
  await request(app)
    .post(`/api/packages/${offer.id}/orders`)
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ idempotencyKey: crypto.randomUUID() })
    .expect(404);
  await request(app)
    .patch('/api/therapists/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      services: therapist.services.map((service) => ({
        ...service.toObject(),
        description: 'Updated description; existing references preserved',
      })),
    })
    .expect(200);
  assert.equal((await Therapist.findById(therapist.id)).services[0].id, therapist.services[0].id);
});
