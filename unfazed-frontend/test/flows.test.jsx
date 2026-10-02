import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntakeForm from '../src/components/crm/IntakeForm.jsx';
import SlotPicker from '../src/components/scheduling/SlotPicker.jsx';
import CheckoutForm from '../src/components/payments/CheckoutForm.jsx';
import { MemoryRouter } from 'react-router-dom';
import ClientTable from '../src/components/crm/ClientTable.jsx';
const template = {
  consentText: 'Fixture informed consent statement',
  consentVersion: 'consent-v1',
};
test('intake cannot submit without an explicit consent checkbox', async () => {
  const submit = vi.fn(),
    user = userEvent.setup();
  render(<IntakeForm template={template} onSubmit={submit} />);
  await user.type(screen.getByLabelText('Age'), '29');
  await user.type(screen.getByLabelText('What brings you here?'), 'Support with work stress.');
  await user.click(screen.getByRole('button', { name: 'Submit intake' }));
  expect(submit).not.toHaveBeenCalled();
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Submit intake' }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0][0].consent).toEqual({ accepted: true, version: 'consent-v1' });
});
test('slot picker displays client timezone and passes the exact UTC slot to booking', async () => {
  const select = vi.fn(),
    slot = { start: '2030-01-07T03:30:00Z', end: '2030-01-07T04:30:00Z' };
  render(<SlotPicker slots={[slot]} timezone="America/New_York" onSelect={select} />);
  const button = screen.getByRole('button');
  expect(button.textContent).toContain('10:30 PM');
  await userEvent.click(button);
  expect(select).toHaveBeenCalledWith(slot);
});
test('slot picker presents a useful empty state', () => {
  render(<SlotPicker slots={[]} timezone="Asia/Kolkata" onSelect={() => {}} />);
  expect(screen.getByText(/No times available/)).toBeTruthy();
});
test('CRM table links the client profile and supports sort actions', async () => {
  const sort = vi.fn();
  render(
    <MemoryRouter>
      <ClientTable
        clients={[
          {
            _id: 'client-id',
            name: 'Ananya',
            email: 'fixture@example.test',
            status: 'active',
            tags: [{ label: 'Online' }],
          },
        ]}
        onSort={sort}
        sort="name"
        direction="asc"
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link').getAttribute('href')).toBe('/clients/client-id');
  await userEvent.click(screen.getByRole('button', { name: /Last session/ }));
  expect(sort).toHaveBeenCalledWith('lastSession');
});
test('checkout failure is visible and cannot fabricate payment success', async () => {
  const paid = vi.fn(),
    client = { post: vi.fn().mockRejectedValue(new Error('Gateway unavailable')) };
  render(<CheckoutForm sessionId="fixture" client={client} onPaid={paid} />);
  await userEvent.click(screen.getByRole('button', { name: 'Pay with Razorpay' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Gateway unavailable');
  expect(paid).not.toHaveBeenCalled();
});
