import SessionNote from '../models/SessionNote.js';
// Defense in depth: even an accidentally fully-selected document cannot expose private fields.
export function clientNote(note) {
  const base = {
    _id: note._id,
    session: note.session,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    type: 'shared',
  };
  if (note.type === 'shared')
    return { ...base, title: note.title, format: note.format, content: note.content };
  if (!note.content && note.sharedContent)
    return { ...base, format: 'legacy', sharedContent: note.sharedContent };
  return null;
}
export async function sharedNotes(client) {
  const notes = await SessionNote.find({
    client: client.id,
    therapist: client.therapist,
    $or: [{ type: 'shared' }, { content: { $exists: false }, sharedContent: { $ne: '' } }],
  })
    .select('_id type title format content sharedContent session createdAt updatedAt')
    .sort({ createdAt: -1 })
    .limit(200);
  return notes.map(clientNote).filter(Boolean);
}
