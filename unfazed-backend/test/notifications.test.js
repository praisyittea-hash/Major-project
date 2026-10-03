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
  assert.equal(await NotificationJob.countDocuments({ kind: event.kind }), 1);
  assert.equal((await NotificationJob.findOne({ kind: event.kind })).status, 'stubbed');
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
  assert.equal(await NotificationJob.countDocuments({ kind: 'session.reminder' }), 1);
});
