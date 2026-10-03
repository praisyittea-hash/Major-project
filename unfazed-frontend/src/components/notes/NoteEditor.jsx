import { useRef } from 'react';
import { noteFormats, emptyContent } from '../../../../shared/noteFormats.js';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
export const blankNote = () => ({
  type: 'private',
  title: '',
  format: 'freeform',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
});
export default function NoteEditor({ value, onChange, onSubmit, busy }) {
  const drafts = useRef({});
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content: value.format === 'freeform' ? value.content : emptyContent('freeform'),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Note content',
        'aria-multiline': 'true',
        class: 'note-input',
      },
    },
    onUpdate: ({ editor }) =>
      value.format === 'freeform' && onChange({ ...value, content: editor.getJSON() }),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Note title
        <input
          value={value.title}
          maxLength={200}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </label>
      <label>
        Visibility
        <select
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value })}
        >
          <option value="private">Private — therapist only</option>
          <option value="shared">Shared with this client</option>
        </select>
      </label>
      <p className="muted">
        {value.type === 'shared'
          ? 'The client can read the entire note after you save.'
          : 'Only your practice can read this note.'}
      </p>
      <label>
        Note format
        <select
          value={value.format}
          onChange={(event) => {
            const format = event.target.value;
            drafts.current[value.format] =
              value.format === 'freeform' ? editor.getJSON() : value.content;
            const content = drafts.current[format] || emptyContent(format);
            onChange({ ...value, format, content });
            if (format === 'freeform') editor.commands.setContent(content, { emitUpdate: false });
          }}
        >
          {Object.entries(noteFormats).map(([key, config]) => (
            <option value={key} key={key}>
              {config.label}
            </option>
          ))}
        </select>
      </label>
      {value.format === 'freeform' ? (
        <>
          <div className="row" role="toolbar" aria-label="Note formatting">
            {[
              ['Bold', 'toggleBold'],
              ['Italic', 'toggleItalic'],
              ['Bullet list', 'toggleBulletList'],
              ['Undo', 'undo'],
              ['Redo', 'redo'],
            ].map(([label, command]) => (
              <button
                className="secondary"
                type="button"
                key={label}
                disabled={!editor || busy}
                onClick={() => editor.chain().focus()[command]().run()}
              >
                {label}
              </button>
            ))}
          </div>
          <EditorContent editor={editor} />
        </>
      ) : (
        noteFormats[value.format].fields.map((key) => (
          <label key={key}>
            {key[0].toUpperCase() + key.slice(1)}
            <textarea
              rows={4}
              maxLength={10000}
              value={value.content[key] || ''}
              onChange={(event) =>
                onChange({ ...value, content: { ...value.content, [key]: event.target.value } })
              }
            />
          </label>
        ))
      )}
      <button disabled={busy || !editor}>{busy ? 'Saving…' : 'Save note'}</button>
    </form>
  );
}
