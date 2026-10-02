import { test } from 'node:test';
import assert from 'node:assert/strict';
import Therapist from '../src/models/Therapist.js';
test('therapist schema validates profile and does not serialize credentials', () => {
  const therapist = new Therapist({
    email: 'Dr@Example.com',
    name: 'Dr Meera',
    password_hash: 'not-plaintext',
    services: [{ name: 'Individual therapy', rate: 150000 }],
  });
  assert.equal(therapist.email, 'dr@example.com');
  assert.equal(therapist.validateSync(), undefined);
  assert.equal(therapist.toJSON().password_hash, undefined);
  assert.ok(new Therapist({ name: 'Missing email' }).validateSync());
});
