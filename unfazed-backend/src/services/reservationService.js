import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Availability from '../models/Availability.js';
import Therapist from '../models/Therapist.js';
import { notifyWaitlist } from './waitlistService.js';
import { availabilityChanged } from '../sockets/schedulingSocket.js';
export async function expireReservations() {
  const stale = await Session.find({
    status: 'pending_payment',
    holdExpiresAt: { $lte: new Date() },
  }).limit(100);
  for (const candidate of stale) {
    const expired = await mongoose.connection.transaction(async (transaction) => {
      await Availability.updateOne(
        { therapist: candidate.therapist },
        { $inc: { revision: 1 } },
        { session: transaction },
      );
      return Session.findOneAndUpdate(
        { _id: candidate.id, status: 'pending_payment', holdExpiresAt: { $lte: new Date() } },
        { $set: { status: 'cancelled' } },
        { new: true, session: transaction },
      );
    });
    if (expired) {
      await notifyWaitlist(expired);
      const therapist = await Therapist.findById(expired.therapist);
      if (therapist) availabilityChanged(therapist.slug);
    }
  }
  return stale.length;
}
export function startReservationWorker() {
  const timer = setInterval(
    () =>
      expireReservations().catch((error) =>
        console.error('Reservation cleanup failed:', error.message),
      ),
    60000,
  );
  timer.unref();
  return () => clearInterval(timer);
}
