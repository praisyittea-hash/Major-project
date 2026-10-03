import mongoose from 'mongoose';
import Client from '../models/Client.js';
import Therapist from '../models/Therapist.js';
import { hasFeature } from './entitlementService.js';
import { HttpError } from '../middleware/errorHandler.js';
export async function conversationAccess(auth, clientId) {
  if (!mongoose.isObjectIdOrHexString(clientId)) throw new HttpError(400, 'Valid client required');
  if (!['therapist', 'client'].includes(auth.role)) throw new HttpError(403, 'Chat access denied');
  if (auth.role === 'client' && auth.sub !== clientId)
    throw new HttpError(403, 'Chat access denied');
  const therapistId = auth.role === 'therapist' ? auth.sub : auth.therapistId;
  const client = await Client.findOne({
    _id: clientId,
    therapist: therapistId,
    status: { $ne: 'archived' },
  });
  if (!client) throw new HttpError(404, 'Conversation not found');
  const therapist = await Therapist.findById(client.therapist);
  if (!therapist || !(await hasFeature(therapist, 'crm')))
    throw new HttpError(403, 'Chat unavailable');
  return {
    therapist: therapist.id,
    client: client.id,
    room: `conversation:${therapist.id}:${client.id}`,
  };
}
export function messageText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000)
    throw new HttpError(400, 'Message must contain 1–4000 characters');
  return text.trim();
}
