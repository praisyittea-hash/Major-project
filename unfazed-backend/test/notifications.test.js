import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { database } from './helpers.js';
import { NotificationService } from '../src/services/notificationService.js';
import DomainEvent from '../src/models/DomainEvent.js';
import NotificationJob from '../src/models/NotificationJob.js';
let close;
before(async () => {
  close = await database();
  await DomainEvent.init();
  await NotificationJob.init();
});
after(async () => {
  if (close) await close();
});
test('transactional notification outbox rolls back with domain writes and dispatch is idempotent', async () => {
  const event = {
    key: 'fixture-booking',
    kind: 'booking.confirmed',
    therapist: new mongoose.Types.ObjectId(),
    recipient: 'fixture@example.test',
    payload: { sessionId: 'fixture' },
  };
  await assert.rejects(
    mongoose.connection.transaction(async (transaction) => {
      await NotificationService.publish({ ...event, key: 'rolled-back' }, transaction);
      throw new Error('Rollback');
    }),
  );
  assert.equal(await DomainEvent.countDocuments({ key: 'rolled-back' }), 0);
  await NotificationService.publish(event);
  await NotificationService.publish(event);
  assert.equal(await DomainEvent.countDocuments({ key: event.key }), 1);
  await NotificationService.dispatchPending();
  await NotificationService.dispatchPending();
  assert.equal(await NotificationJob.countDocuments({ kind: event.kind, channel: 'whatsapp' }), 1);
  assert.equal(
    (await NotificationJob.findOne({ kind: event.kind, channel: 'whatsapp' })).status,
    'queued',
  );
});
import Session from '../src/models/Session.js';
import { scheduleSessionEvents } from '../src/services/sessionNotificationService.js';
test('24-hour reminder and completed-session follow-up are queued once, excluding cancelled and pending sessions', async () => {
  const now = new Date('2030-01-01T12:00:00Z'),
    therapist = new mongoose.Types.ObjectId();
  for (const [status, hours] of [
    ['confirmed', 24],
    ['confirmed', 25],
    ['cancelled', 12],
    ['pending_payment', 12],
    ['completed', -2],
  ]) {
    const start = new Date(now.getTime() + hours * 3600000);
    await Session.create({
      therapist,
      contact: { name: 'Reminder Fixture', email: 'reminder@example.test' },
      duration: 60,
      start,
      end: new Date(start.getTime() + 3600000),
      status,
    });
  }
  assert.equal(await scheduleSessionEvents(now), 2);
  assert.equal(await scheduleSessionEvents(now), 0);
  assert.equal(await DomainEvent.countDocuments({ kind: 'session.reminder' }), 1);
  assert.equal(await DomainEvent.countDocuments({ kind: 'session.followup' }), 1);
  await NotificationService.dispatchPending();
  assert.equal(
    await NotificationJob.countDocuments({ kind: 'session.reminder', channel: 'whatsapp' }),
    1,
  );
});
import { createServer } from 'node:net';
import nodemailer from 'nodemailer';
import { emailProvider } from '../src/services/notificationProviders/emailProvider.js';
import { deliverNotifications } from '../src/services/notificationDeliveryService.js';
import { whatsappStub } from '../src/services/notificationProviders/whatsappStub.js';
test('WhatsApp stays stubbed while Nodemailer sends an email to a real local SMTP fixture', async () => {
  let received = '';
  const smtp = createServer((socket) => {
    socket.write('220 fixture SMTP\r\n');
    let buffer = '',
      data = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'),
          line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') {
            data = false;
            socket.write('250 accepted\r\n');
          } else received += line + '\n';
        } else if (/^EHLO|^HELO/i.test(line)) socket.write('250 fixture\r\n');
        else if (/^DATA/i.test(line)) {
          data = true;
          socket.write('354 send data\r\n');
        } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  process.env.EMAIL_ENABLED = 'true';
  const transport = nodemailer.createTransport({
    host: '127.0.0.1',
    port: smtp.address().port,
    secure: false,
    ignoreTLS: true,
  });
  try {
    await NotificationService.publish({
      key: 'smtp-fixture',
      kind: 'booking.confirmed',
      therapist: new mongoose.Types.ObjectId(),
      recipient: 'smtp@example.test',
      payload: {},
    });
    await NotificationService.dispatchPending();
    await deliverNotifications({ whatsapp: whatsappStub, email: emailProvider(transport) });
    assert.match(received, /Subject: Booking confirmed/);
    assert.match(received, /To: smtp@example.test/);
    const email = await NotificationJob.findOne({ key: 'event:smtp-fixture:email' });
    const whatsapp = await NotificationJob.findOne({ key: 'event:smtp-fixture:whatsapp' });
    assert.equal(email.status, 'sent');
    assert.ok(email.acceptedAt);
    assert.equal(whatsapp.status, 'stubbed');
    assert.equal(whatsapp.acceptedAt, undefined);
    assert.match(whatsapp.detail, /no message was sent/);
  } finally {
    delete process.env.EMAIL_ENABLED;
    transport.close();
    await new Promise((resolve) => smtp.close(resolve));
  }
});
test('notification provider failures persist as retryable failures without exposing provider secrets', async () => {
  process.env.EMAIL_ENABLED = 'true';
  try {
    await NotificationService.publish({
      key: 'failed-provider-fixture',
      kind: 'payment.captured',
      therapist: new mongoose.Types.ObjectId(),
      recipient: 'failure@example.test',
      payload: {},
    });
    await NotificationService.dispatchPending();
    await deliverNotifications({
      whatsapp: whatsappStub,
      email: {
        send: async () => {
          throw new Error('secret-provider-password');
        },
      },
    });
    const failed = await NotificationJob.findOne({ key: 'event:failed-provider-fixture:email' });
    assert.equal(failed.status, 'failed');
    assert.ok(failed.nextAttemptAt > new Date());
    assert.ok(!JSON.stringify(failed).includes('secret-provider-password'));
  } finally {
    delete process.env.EMAIL_ENABLED;
  }
});
