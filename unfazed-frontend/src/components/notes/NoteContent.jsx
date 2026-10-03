import { noteFormats } from '../../../../shared/noteFormats.js';
import { createElement } from 'react';
const tags = {
  doc: 'div',
  paragraph: 'p',
  bulletList: 'ul',
  orderedList: 'ol',
  listItem: 'li',
  blockquote: 'blockquote',
  codeBlock: 'pre',
  hardBreak: 'br',
  horizontalRule: 'hr',
};
function renderNode(node, key) {
  if (node.type === 'text') {
    return (node.marks || []).reduce(
      (text, mark) =>
        createElement(
          { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' }[mark.type] ||
            'span',
          { key: mark.type },
          text,
        ),
      node.text,
    );
  }
  const tag =
    node.type === 'heading'
      ? `h${[1, 2, 3, 4, 5, 6].includes(node.attrs?.level) ? node.attrs.level : 3}`
      : tags[node.type] || 'div';
  return createElement(
    tag,
    { key },
    node.content?.map((child, i) => renderNode(child, i)),
  );
}
export default function NoteContent({ note }) {
  if (note.content && noteFormats[note.format]?.fields.length)
    return (
      <dl>
        {noteFormats[note.format].fields.map((key) => (
          <div key={key}>
            <dt>
              <strong>{key[0].toUpperCase() + key.slice(1)}</strong>
            </dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{note.content[key]}</dd>
          </div>
        ))}
      </dl>
    );
  if (note.content) return <div className="note-content">{renderNode(note.content, 'doc')}</div>;
  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {note.privateContent && (
        <>
          <h3>Private (legacy)</h3>
          <p>{note.privateContent}</p>
        </>
      )}
      {note.sharedContent && (
        <>
          <h3>Shared reflection</h3>
          <p>{note.sharedContent}</p>
        </>
      )}
    </div>
  );
}
