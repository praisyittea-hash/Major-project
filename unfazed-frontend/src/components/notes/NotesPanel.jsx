import UpgradePrompt, { entitlementFailure } from '../subscription/UpgradePrompt.jsx';
import { useCallback, useEffect, useState } from 'react';
import api, { messageOf } from '../../api/axiosInstance.js';
import NoteEditor, { blankNote } from './NoteEditor.jsx';
import NoteContent from './NoteContent.jsx';
export default function NotesPanel({ clientId }) {
  const [upgrade, setUpgrade] = useState(null);
  const [notes, setNotes] = useState([]),
    [draft, setDraft] = useState(blankNote),
    [selected, setSelected] = useState(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/notes/client/${clientId}`);
      setNotes(data.notes);
      setLoaded(true);
    } catch (e) {
      setError(messageOf(e));
      setUpgrade(entitlementFailure(e));
    }
  }, [clientId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  function select(note) {
    setSelected(note?._id || null);
    setDraft(
      note
        ? { type: note.type, title: note.title, format: note.format, content: note.content }
        : blankNote(),
    );
    setRevision((n) => n + 1);
    setError('');
    setUpgrade(null);
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      await (selected
        ? api.patch(`/notes/${selected}`, draft)
        : api.post(`/notes/client/${clientId}`, draft));
      select(null);
      await refresh();
    } catch (e) {
      setError(messageOf(e));
      setUpgrade(entitlementFailure(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!window.confirm('Delete this note permanently?')) return;
    setBusy(true);
    try {
      await api.delete(`/notes/${id}`);
      if (id === selected) select(null);
      await refresh();
    } catch (e) {
      setError(messageOf(e));
      setUpgrade(entitlementFailure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Clinical documentation</h2>
      {upgrade && <UpgradePrompt feature={upgrade.feature} onDismiss={() => setUpgrade(null)} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h3>{selected ? 'Edit note' : 'New note'}</h3>
      <NoteEditor key={revision} value={draft} onChange={setDraft} onSubmit={save} busy={busy} />
      {selected && (
        <button className="secondary" onClick={() => select(null)}>
          Cancel editing
        </button>
      )}
      {!loaded ? (
        <p>Loading notes…</p>
      ) : notes.length ? (
        notes.map((note) => (
          <article className="card" key={note._id}>
            <p className="tag">{note.content ? note.type : 'Legacy note'}</p>
            <h3>{note.title || 'Session note'}</h3>
            <p className="muted">{new Date(note.createdAt).toLocaleString()}</p>
            <NoteContent note={note} />
            <div className="row">
              {note.content && (
                <button className="secondary" disabled={busy} onClick={() => select(note)}>
                  Edit note
                </button>
              )}
              <button className="danger" disabled={busy} onClick={() => remove(note._id)}>
                Delete note
              </button>
            </div>
          </article>
        ))
      ) : (
        <p>No notes yet.</p>
      )}
    </section>
  );
}
