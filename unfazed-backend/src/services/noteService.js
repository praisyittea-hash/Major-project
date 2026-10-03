import SessionNote from '../models/SessionNote.js';
import Client from '../models/Client.js';
import Session from '../models/Session.js';
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
export async function validateNoteReferences(therapist, clientId, sessionId) {
  await noteClient(therapist, clientId);
  if (sessionId && !(await Session.exists({ _id: sessionId, therapist, client: clientId })))
    throw new HttpError(404, 'Session not found for this client');
}
// Accept a bounded TipTap document, never arbitrary HTML, attributes or embedded assets.
export function validateRichText(document) {
  let count = 0;
  const nodes = new Set([
    'doc',
    'paragraph',
    'text',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'codeBlock',
    'hardBreak',
    'horizontalRule',
  ]);
  const marks = new Set(['bold', 'italic', 'strike', 'code', 'underline']);
  function visit(node, depth = 0) {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node) ||
      depth > 20 ||
      ++count > 2000 ||
      !nodes.has(node.type)
    )
      return false;
    if (
      Object.keys(node).some((key) => !['type', 'content', 'text', 'marks', 'attrs'].includes(key))
    )
      return false;
    if (node.type === 'text' && (typeof node.text !== 'string' || node.text.length > 30000))
      return false;
    if (
      node.marks &&
      (!Array.isArray(node.marks) ||
        node.marks.some(
          (mark) => !marks.has(mark.type) || Object.keys(mark).some((key) => key !== 'type'),
        ))
    )
      return false;
    if (
      node.attrs &&
      (typeof node.attrs !== 'object' ||
        Array.isArray(node.attrs) ||
        Object.keys(node.attrs).some((key) => !['level', 'start', 'language'].includes(key)) ||
        (node.attrs.level !== undefined && ![1, 2, 3, 4, 5, 6].includes(node.attrs.level)))
    )
      return false;
    return (
      !node.content ||
      (Array.isArray(node.content) && node.content.every((child) => visit(child, depth + 1)))
    );
  }
  return document?.type === 'doc' && JSON.stringify(document).length <= 45000 && visit(document);
}
