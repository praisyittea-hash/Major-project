export default function MessageBubble({ message, own }) {
  return (
    <article className={`message-bubble ${own ? 'own' : ''}`}>
      <p>{message.text}</p>
      <small>
        {own ? 'You' : message.senderRole === 'therapist' ? 'Therapist' : 'Client'} ·{' '}
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </small>
    </article>
  );
}
