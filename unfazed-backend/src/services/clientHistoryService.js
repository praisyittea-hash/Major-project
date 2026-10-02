import mongoose from 'mongoose';
import Session from '../models/Session.js';
import SessionNote from '../models/SessionNote.js';
export async function clientHistory(client, { sharedOnly = false } = {}) {
  const filter = { client: client.id, therapist: client.therapist };
  const [sessions, payments, notes] = await Promise.all([
    Session.find(filter).sort({ start: -1 }).limit(200),
    // Module 4 registers Payment. Before that, an empty payment history is accurate.
    mongoose.models.Payment
      ? mongoose.models.Payment.find(filter)
          .select('-gateway_signature -webhookEvents')
          .sort({ createdAt: -1 })
          .limit(200)
      : [],
    sharedOnly
      ? SessionNote.find({ ...filter, sharedContent: { $ne: '' } })
          .select('sharedContent session createdAt')
          .sort({ createdAt: -1 })
          .limit(200)
      : SessionNote.find(filter).select('+privateContent').sort({ createdAt: -1 }).limit(200),
  ]);
  return { sessions, payments, notes };
}
