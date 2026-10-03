import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../src/components/chat/MessageBubble.jsx';
test('message bubbles display user content as text and identify its sender', () => {
  const { container } = render(
    <MessageBubble
      message={{
        text: '<script>unsafe()</script>',
        senderRole: 'client',
        createdAt: '2030-01-01T12:00:00Z',
      }}
      own={false}
    />,
  );
  expect(screen.getByText('<script>unsafe()</script>')).toBeTruthy();
  expect(screen.getByText(/Client/)).toBeTruthy();
  expect(container.querySelector('script')).toBeNull();
});
