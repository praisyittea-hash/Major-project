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
