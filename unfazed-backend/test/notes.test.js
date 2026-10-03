import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SessionNote from '../src/models/SessionNote.js';
test('session notes default to private and reject unsupported visibility', () => {
  const fields = {
    therapist: new mongoose.Types.ObjectId(),
    client: new mongoose.Types.ObjectId(),
  };
  const note = new SessionNote(fields);
  assert.equal(note.type, 'private');
  assert.equal(note.validateSync(), undefined);
  assert.equal(
    new SessionNote({ ...fields, type: 'public' }).validateSync().errors.type.kind,
    'enum',
  );
  assert.equal(new SessionNote({ ...fields, type: 'shared' }).validateSync(), undefined);
  assert.equal(SessionNote.schema.path('content').options.select, false);
});
