import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Client from '../models/Client.js';
import Therapist from '../models/Therapist.js';
import { HttpError } from '../middleware/errorHandler.js';
import { issueToken } from '../services/tokenService.js';
import { hasFeature, assertAccess } from '../services/entitlementService.js';
import { persistIntake } from '../services/intakeService.js';
export async function submitIntake(req, res) {
  res.json({ client: await persistIntake(req.client, req.body) });
}
export async function bookingIntake(req, res) {
  const session = await Session.findById(req.params.id);
  if (!session || req.auth.role !== 'booking' || req.auth.sub !== session.id)
    throw new HttpError(403, 'Booking intake access denied');
  if (session.status === 'cancelled') throw new HttpError(409, 'Booking has been cancelled');
  const therapist = await Therapist.findById(session.therapist);
  if (!(await hasFeature(therapist, 'crm'))) throw new HttpError(403, 'Intake is unavailable');
  const client = await mongoose.connection.transaction(async (transaction) => {
    await Therapist.updateOne(
      { _id: therapist.id },
      { $inc: { crmRevision: 1 } },
      { session: transaction },
    );
    let client = await Client.findOne({ therapist: therapist.id, email: session.contact.email })
      .select('+originBooking')
      .session(transaction);
    if (client && String(client.originBooking) !== session.id)
      throw new HttpError(409, 'Please ask the practice for your existing client portal link');
    if (!client) {
      await assertAccess(therapist.id, 'clients_add', { session: transaction });
      [client] = await Client.create(
        [
          {
            therapist: therapist.id,
            name: session.contact.name,
            email: session.contact.email,
            originBooking: session.id,
          },
        ],
        { session: transaction },
      );
    }
    const updated = await persistIntake(client, req.body, transaction);
    await Session.updateOne(
      { _id: session.id },
      { $set: { client: client.id } },
      { session: transaction },
    );
    return updated;
  });
  res.json({ client, token: issueToken(client.id, 'client', { therapistId: therapist.id }) });
}
