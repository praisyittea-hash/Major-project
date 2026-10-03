import DomainEvent from '../models/DomainEvent.js';
import { notificationEvents } from '../config/notificationEvents.js';
import NotificationJob from '../models/NotificationJob.js';
// Legacy waitlist calls default to a stub. Domain-event jobs use isolated delivery providers.
export const notificationService = {
  queue: async ({
    key,
    kind,
    recipient,
    payload,
    event,
    therapist,
    client,
    channel,
    status = 'stubbed',
  }) =>
    NotificationJob.findOneAndUpdate(
      { key },
      { $setOnInsert: { kind, recipient, payload, event, therapist, client, channel, status } },
      { upsert: true, new: true },
    ),
};
// Transactional outbox: producers publish inside the same transaction as domain writes.
// Dispatch can be retried after a process restart without losing or duplicating queued jobs.
export const NotificationService = {
  async publish(event, transaction = null) {
    if (!notificationEvents[event.kind]) throw new Error('Unsupported notification event');
    const { key, kind, therapist, client, recipient, payload } = event;
    return DomainEvent.findOneAndUpdate(
      { key },
      { $setOnInsert: { kind, therapist, client, recipient, payload } },
      { new: true, upsert: true, session: transaction },
    );
  },
  async dispatchPending() {
    const events = await DomainEvent.find({ dispatchedAt: { $exists: false } })
      .sort({ createdAt: 1 })
      .limit(100);
    for (const event of events) {
      for (const channel of ['whatsapp', 'email'])
        await notificationService.queue({
          key: `event:${event.key}:${channel}`,
          kind: event.kind,
          recipient: event.recipient,
          payload: event.payload,
          event: event.id,
          therapist: event.therapist,
          client: event.client,
          channel,
          status:
            channel === 'email' && process.env.EMAIL_ENABLED !== 'true' ? 'disabled' : 'queued',
        });
      await DomainEvent.updateOne({ _id: event.id }, { $set: { dispatchedAt: new Date() } });
    }
    return events.length;
  },
};
