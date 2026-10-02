import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import Session from '../models/Session.js';
import Therapist from '../models/Therapist.js';
import { paymentGateway } from './paymentGateway.js';
import { moneyBreakdown } from '../config/payments.js';
import { hasFeature } from './entitlementService.js';
import { HttpError } from '../middleware/errorHandler.js';
export const gatewayFor = (req) => req.app.locals.paymentGateway || paymentGateway;
export function canAccessPayment(auth, payment) {
  return (
    (auth.role === 'therapist' && auth.sub === String(payment.therapist)) ||
    (auth.role === 'client' &&
      auth.sub === String(payment.client) &&
      auth.therapistId === String(payment.therapist)) ||
    (auth.role === 'booking' && auth.sub === String(payment.session))
  );
}
export async function ownedPayment(req) {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new HttpError(404, 'Payment not found');
  if (!canAccessPayment(req.auth, payment)) throw new HttpError(403, 'Payment access denied');
  return payment;
}
export async function orderForPayment(payment, gateway) {
  if (payment.gateway_order_id) return payment;
  // Claim the external request once. Ambiguous failures require reconciliation;
  // retries must not silently create a second chargeable order.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment.id, orderRequestedAt: { $exists: false } },
    { $set: { orderRequestedAt: new Date() } },
    { new: true },
  );
  if (!claimed)
    throw new HttpError(409, 'Order creation is in progress or needs practice reconciliation');
  try {
    const order = await gateway.createOrder({
      amount: claimed.amount,
      currency: claimed.currency,
      receipt: claimed.id,
    });
    if (!order.id || order.amount !== claimed.amount || order.currency !== claimed.currency)
      throw new Error('Unexpected gateway response');
    claimed.gateway_order_id = order.id;
    await claimed.save();
    return claimed;
  } catch (e) {
    claimed.status = 'order_error';
    claimed.failureReason = 'Order creation needs reconciliation';
    await claimed.save();
    throw e instanceof HttpError ? e : new HttpError(502, 'Unable to create payment order');
  }
}
export async function sessionOrder(req) {
  const gateway = gatewayFor(req),
    key = gateway.publicKey();
  const session = await Session.findById(req.params.id);
  if (!session) throw new HttpError(404, 'Session not found');
  if (
    !(req.auth.role === 'booking' && req.auth.sub === session.id) &&
    !(
      req.auth.role === 'client' &&
      req.auth.sub === String(session.client) &&
      req.auth.therapistId === String(session.therapist)
    )
  )
    throw new HttpError(403, 'Session payment access denied');
  if (
    session.status === 'cancelled' ||
    (session.holdExpiresAt &&
      session.holdExpiresAt <= new Date() &&
      session.status === 'pending_payment')
  )
    throw new HttpError(409, 'Reservation expired or cancelled. Please choose a new time');
  if (['paid', 'package'].includes(session.paymentStatus))
    throw new HttpError(409, 'Session already paid');
  if (session.rate === 0) throw new HttpError(400, 'This session does not require a payment');
  const therapist = await Therapist.findById(session.therapist);
  if (!(await hasFeature(therapist, 'payments'))) throw new HttpError(403, 'Payments unavailable');
  const client = await Client.findOne({
    _id: session.client,
    therapist: session.therapist,
    status: { $ne: 'archived' },
  });
  if (!client?.consentAt) throw new HttpError(409, 'Complete intake and consent before payment');
  const payment = await Payment.findOneAndUpdate(
    { purchaseKey: `session:${session.id}` },
    {
      $setOnInsert: {
        therapist: session.therapist,
        client: client.id,
        session: session.id,
        ...moneyBreakdown(session.rate),
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  return { payment: await orderForPayment(payment, gateway), key };
}
