import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SharedNotes from '../src/components/notes/SharedNotes.jsx';
import NoteContent from '../src/components/notes/NoteContent.jsx';
test('client shared notes render rich text and legacy shared reflections safely', () => {
  const { container } = render(
    <SharedNotes
      notes={[
        {
          _id: 'new',
          type: 'shared',
          title: 'Our reflection',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'bold' }] },
                ],
              },
            ],
          },
        },
        { _id: 'old', sharedContent: 'Existing shared reflection' },
      ]}
    />,
  );
  expect(screen.getByText('Our reflection')).toBeTruthy();
  expect(screen.getByText('Existing shared reflection')).toBeTruthy();
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('strong').textContent).toBe('<script>alert(1)</script>');
});
test('therapist can still view both halves of existing legacy notes', () => {
  render(
    <NoteContent
      note={{ privateContent: 'Legacy private record', sharedContent: 'Legacy shared record' }}
    />,
  );
  expect(screen.getByText('Legacy private record')).toBeTruthy();
  expect(screen.getByText('Legacy shared record')).toBeTruthy();
});
test('SOAP and DAP notes display each structured field', () => {
  render(
    <>
      <NoteContent
        note={{
          format: 'soap',
          content: {
            subjective: 'Report',
            objective: 'Observed',
            assessment: 'SOAP assessment',
            plan: 'SOAP plan',
          },
        }}
      />
      <NoteContent
        note={{
          format: 'dap',
          content: { data: 'DAP data', assessment: 'DAP assessment', plan: 'DAP plan' },
        }}
      />
    </>,
  );
  expect(screen.getByText('Report')).toBeTruthy();
  expect(screen.getByText('Observed')).toBeTruthy();
  expect(screen.getByText('DAP data')).toBeTruthy();
  expect(screen.getByText('DAP plan')).toBeTruthy();
});
