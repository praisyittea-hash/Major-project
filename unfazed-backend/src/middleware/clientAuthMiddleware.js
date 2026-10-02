import Therapist from '../models/Therapist.js';
import { hasFeature } from '../services/entitlementService.js';
import Client from '../models/Client.js';
import { HttpError } from './errorHandler.js';
export async function clientOnly(req, _res, next) {
  if (req.auth.role !== 'client') throw new HttpError(403, 'Client portal access required');
  const client = await Client.findOne({
    _id: req.auth.sub,
    therapist: req.auth.therapistId,
    status: { $ne: 'archived' },
  }).select('+intake');
  if (!client) throw new HttpError(403, 'Portal access unavailable');
  const therapist = await Therapist.findById(client.therapist);
  if (!therapist || !(await hasFeature(therapist, 'crm')))
    throw new HttpError(403, 'Portal access unavailable');
  req.client = client;
  next();
}
