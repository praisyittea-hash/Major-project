import { useState } from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteEditor, { blankNote } from '../src/components/notes/NoteEditor.jsx';
function Harness({ submit }) {
  const [value, setValue] = useState(blankNote);
  return <NoteEditor value={value} onChange={setValue} onSubmit={() => submit(value)} />;
}
test('TipTap editor supports visibility, selectable templates and keeps a template draft when switching', async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  render(<Harness submit={submit} />);
  expect(await screen.findByRole('textbox', { name: 'Note content' })).toBeTruthy();
  await user.type(screen.getByLabelText('Note title'), 'Session reflection');
  await user.selectOptions(screen.getByLabelText('Visibility'), 'shared');
  await user.selectOptions(screen.getByLabelText('Note format'), 'soap');
  await user.type(screen.getByLabelText('Subjective'), 'Client perspective');
  await user.selectOptions(screen.getByLabelText('Note format'), 'dap');
  await user.type(screen.getByLabelText('Data'), 'DAP observation');
  await user.selectOptions(screen.getByLabelText('Note format'), 'soap');
  expect(screen.getByLabelText('Subjective').value).toBe('Client perspective');
  await user.click(screen.getByRole('button', { name: 'Save note' }));
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'shared',
      format: 'soap',
      title: 'Session reflection',
      content: expect.objectContaining({ subjective: 'Client perspective' }),
    }),
  );
});
