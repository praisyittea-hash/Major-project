import { invoiceStorage } from './storageService.js';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';
import Availability from '../models/Availability.js';
import Therapist from '../models/Therapist.js';
import { activatePackage } from './packageService.js';
import { invoiceSnapshot, generateInvoice } from './invoiceService.js';
import { availabilityChanged } from '../sockets/schedulingSocket.js';
import { HttpError } from '../middleware/errorHandler.js';
export async function processPaymentEvent(event, eventId) {
  const entity = event.payload?.payment?.entity;
  if (!['payment.captured', 'payment.failed'].includes(event.event)) return { ignored: true };
  if (!entity?.id || !entity.order_id) throw new HttpError(400, 'Payment entity required');
  let changedSlug;
  const result = await mongoose.connection.transaction(async (transaction) => {
    const payment = await Payment.findOne({ gateway_order_id: entity.order_id })
      .select('+webhookEvents')
      .session(transaction);
    if (!payment) throw new HttpError(404, 'Order is unknown; retry after order persistence');
    if (entity.amount !== payment.amount || entity.currency !== payment.currency)
      throw new HttpError(400, 'Webhook amount or currency mismatch');
    if (payment.webhookEvents.includes(eventId)) return { duplicate: true };
    const duplicate = await Payment.exists({
      _id: { $ne: payment.id },
      gateway_transaction_id: entity.id,
    }).session(transaction);
    if (duplicate) throw new HttpError(409, 'Transaction already belongs to another order');
    payment.webhookEvents.push(eventId);
    if (event.event === 'payment.failed') {
      if (entity.status !== 'failed') throw new HttpError(400, 'Invalid failure event');
      if (!['captured', 'refund_required', 'refunded'].includes(payment.status)) {
        payment.status = 'failed';
        payment.failureReason = 'Gateway reported a failed payment attempt';
        if (payment.session)
          await Session.updateOne(
            { _id: payment.session, status: 'pending_payment' },
            { $set: { paymentStatus: 'failed' } },
            { session: transaction },
          );
      }
      await payment.save({ session: transaction });
      return { received: true };
    }
    if (entity.status !== 'captured') throw new HttpError(400, 'Payment must be captured');
    if (['captured', 'refund_required', 'refunded'].includes(payment.status)) {
      if (payment.gateway_transaction_id !== entity.id)
        throw new HttpError(409, 'Order already settled with another transaction');
      await payment.save({ session: transaction });
      return { duplicate: true };
    }
    payment.gateway_transaction_id = entity.id;
    payment.status = 'captured';
    payment.capturedAt = new Date();
    payment.failureReason = undefined;
    if (payment.session) {
      await Availability.updateOne(
        { therapist: payment.therapist },
        { $inc: { revision: 1 } },
        { session: transaction },
      );
      const session = await Session.findById(payment.session).session(transaction);
      if (!session) throw new HttpError(409, 'Paid session is missing');
      const expired =
        session.status === 'cancelled' ||
        (session.status === 'pending_payment' &&
          session.holdExpiresAt &&
          session.holdExpiresAt <= new Date());
      if (expired) {
        payment.status = 'refund_required';
        payment.failureReason = 'Payment arrived after reservation expiry or cancellation';
        session.status = 'cancelled';
        session.paymentStatus = 'refund_required';
      } else {
        session.status = 'confirmed';
        session.paymentStatus = 'paid';
        session.holdExpiresAt = undefined;
      }
      await session.save({ session: transaction });
      const therapist = await Therapist.findById(payment.therapist).session(transaction);
      changedSlug = therapist.slug;
    }
    if (payment.package && payment.status === 'captured')
      await activatePackage(payment, transaction);
    payment.invoiceNumber = `UF-${payment.capturedAt.getUTCFullYear()}-${payment.id.toUpperCase()}`;
    payment.invoiceSnapshot = await invoiceSnapshot(payment, transaction);
    await invoiceStorage.put(payment, await generateInvoice(payment));
    await payment.save({ session: transaction });
    return { received: true, status: payment.status };
  });
  if (changedSlug) availabilityChanged(changedSlug);
  return result;
}
