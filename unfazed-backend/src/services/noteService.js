import SessionNote from '../models/SessionNote.js';
import Client from '../models/Client.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function noteClient(therapist, id) {
  const client = await Client.findOne({ _id: id, therapist });
  if (!client) throw new HttpError(404, 'Client not found');
  return client;
}
export async function ownedNote(therapist, id) {
  const note = await SessionNote.findOne({ _id: id, therapist }).select('+content +privateContent');
  if (!note) throw new HttpError(404, 'Note not found');
  return note;
}
export function noteInput(body) {
  return Object.fromEntries(
    ['type', 'title', 'format', 'content', 'session']
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}
