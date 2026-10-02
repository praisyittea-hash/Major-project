import NotificationJob from '../models/NotificationJob.js';
// Replace this adapter with a delivery provider later. No external messages are sent.
export const notificationService = {
  queue: async ({ key, kind, recipient, payload }) =>
    NotificationJob.findOneAndUpdate(
      { key },
      { $setOnInsert: { kind, recipient, payload, status: 'stubbed' } },
      { upsert: true, new: true },
    ),
};
