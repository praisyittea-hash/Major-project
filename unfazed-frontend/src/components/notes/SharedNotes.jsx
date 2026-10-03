import NoteContent from './NoteContent.jsx';
export default function SharedNotes({ notes }) {
  return (
    <section className="card">
      <h2>Shared reflections</h2>
      {!notes ? (
        <p>Loading shared notes…</p>
      ) : notes.length ? (
        notes.map((note) => (
          <article key={note._id} className="card">
            <h3>{note.title || 'Shared note'}</h3>
            <p className="muted">{new Date(note.createdAt).toLocaleString()}</p>
            <NoteContent note={note} />
          </article>
        ))
      ) : (
        <p>No shared notes yet.</p>
      )}
    </section>
  );
}
