import ChatMessage from '../models/ChatMessage.js';
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
export async function persistMessage(conversation, auth, payload) {
  const text = messageText(payload.text);
  if (
    typeof payload.clientMessageId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.clientMessageId)
  )
    throw new HttpError(400, 'Valid message identifier required');
  const filter = {
    therapist: conversation.therapist,
    client: conversation.client,
    sender: auth.sub,
    clientMessageId: payload.clientMessageId,
  };
  const message = await ChatMessage.findOneAndUpdate(
    filter,
    { $setOnInsert: { text, senderRole: auth.role, createdAt: new Date(), updatedAt: new Date() } },
    { new: true, upsert: true, runValidators: true, timestamps: false },
  );
  if (message.text !== text) throw new HttpError(409, 'Message identifier was already used');
  return message;
}
