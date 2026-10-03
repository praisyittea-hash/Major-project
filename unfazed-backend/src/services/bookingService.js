import { NotificationService } from './notificationService.js';
import ClientPackage from '../models/ClientPackage.js';
import { redeemPackage } from './packageService.js';
import { paymentConfig } from '../config/payments.js';
import mongoose from 'mongoose';
import { formatInTimeZone } from 'date-fns-tz';
import Availability from '../models/Availability.js';
import Session from '../models/Session.js';
import { availableSlots } from './schedulingService.js';
import { HttpError } from '../middleware/errorHandler.js';
// Every booking writes the same therapist availability document in a transaction.
// MongoDB retries write conflicts; the retried slot check sees the winning booking.
export async function createBooking(
  therapist,
  service,
  contact,
  start,
  { client, clientPackage } = {},
) {
  return mongoose.connection.transaction(async (transaction) => {
    const availability = await Availability.findOneAndUpdate(
      { therapist: therapist.id },
      { $inc: { revision: 1 } },
      { new: true, session: transaction },
    );
    if (!availability) throw new HttpError(409, 'No availability configured');
    const date = formatInTimeZone(start, availability.timezone, 'yyyy-MM-dd');
    const offered = await availableSlots(therapist.id, date, date, service.duration, transaction);
    if (!offered.some((s) => s.start === start.toISOString()))
      throw new HttpError(409, 'This time is no longer available');
    const pkg = clientPackage
      ? await redeemPackage(clientPackage, client, therapist.id, service, start, transaction)
      : null;
    const rate = pkg
      ? pkg.baseRate + (pkg.usedSessions.length < pkg.rateRemainder ? 1 : 0)
      : service.rate;
    const [session] = await Session.create(
      [
        {
          therapist: therapist.id,
          contact,
          client,
          serviceId: service.id,
          start,
          end: new Date(start.getTime() + service.duration * 60000),
          duration: service.duration,
          bufferMinutes: availability.bufferMinutes,
          rate,
          package: pkg?.id,
          status: !pkg && service.rate > 0 ? 'pending_payment' : 'confirmed',
          paymentStatus: pkg ? 'package' : service.rate > 0 ? 'pending' : 'unpaid',
          ...(!pkg && service.rate > 0
            ? { holdExpiresAt: new Date(Date.now() + paymentConfig().holdMinutes * 60000) }
            : {}),
        },
      ],
      { session: transaction },
    );
    if (pkg)
      await ClientPackage.updateOne(
        { _id: pkg.id },
        { $addToSet: { usedSessions: session.id } },
        { session: transaction },
      );
    if (session.status === 'confirmed')
      await NotificationService.publish(
        {
          key: `booking:${session.id}:confirmed`,
          kind: 'booking.confirmed',
          therapist: therapist.id,
          client: session.client,
          recipient: contact.email,
          payload: { sessionId: session.id, start: session.start },
        },
        transaction,
      );
    return session;
  });
}
