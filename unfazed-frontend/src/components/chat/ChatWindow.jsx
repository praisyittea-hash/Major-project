import { useRef, useState } from 'react';
import useChat from '../../hooks/useChat.js';
import MessageBubble from './MessageBubble.jsx';
export default function ChatWindow({ clientId, role }) {
  const chat = useChat(clientId, role),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(null);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    if (pending.current?.text !== text) pending.current = { text, id: crypto.randomUUID() };
    try {
      await chat.send(text, pending.current.id);
      setText('');
      pending.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Messages</h2>
      <p className="muted" role="status">
        {chat.connected ? 'Connected' : 'Connecting to chat…'}
      </p>
      {(error || chat.error) && (
        <p className="error" role="alert">
          {error || chat.error}
        </p>
      )}
      <div className="chat-history" role="log" aria-label="Conversation" aria-live="polite">
        {chat.messages.length ? (
          chat.messages.map((message) => (
            <MessageBubble key={message._id} message={message} own={message.senderRole === role} />
          ))
        ) : (
          <p>No messages yet.</p>
        )}
      </div>
      <form onSubmit={submit}>
        <label>
          Message
          <textarea
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </label>
        <button disabled={!chat.connected || busy || !text.trim()}>
          {busy ? 'Sending…' : 'Send message'}
        </button>
      </form>
      <p className="muted">
        For non-urgent care communication. Contact local emergency services if you need immediate
        help.
      </p>
    </section>
  );
}
