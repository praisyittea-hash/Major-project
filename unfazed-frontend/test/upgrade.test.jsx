import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpgradePrompt from '../src/components/subscription/UpgradePrompt.jsx';
test('upgrade prompt explains blocked access and opens options without discarding the current page', async () => {
  const dismiss = vi.fn();
  render(
    <>
      <textarea aria-label="Existing draft" defaultValue="Unsaved clinical draft" />
      <UpgradePrompt feature="note_soap" onDismiss={dismiss} />
    </>,
  );
  expect(screen.getByRole('alert').textContent).toContain('SOAP note templates');
  const link = screen.getByRole('link', { name: 'Review upgrade options' });
  expect(link.getAttribute('href')).toBe('/subscription');
  expect(link.getAttribute('target')).toBe('_blank');
  await userEvent.click(screen.getByRole('button', { name: 'Keep working' }));
  expect(dismiss).toHaveBeenCalled();
  expect(screen.getByLabelText('Existing draft').value).toBe('Unsaved clinical draft');
});
