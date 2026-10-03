import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { database } from './helpers.js';
import { app } from '../src/app.js';
import Therapist from '../src/models/Therapist.js';
import Client from '../src/models/Client.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-note-test-secret-never-for-production';
let close, therapist, client, auth;
before(async () => {
  close = await database();
  therapist = await Therapist.create({
    name: 'Notes Therapist',
    email: 'notes@example.test',
    password_hash: 'fixture',
  });
  client = await Client.create({
    therapist: therapist.id,
    name: 'Notes Client',
    email: 'client@example.test',
  });
  auth = { Authorization: `Bearer ${issueToken(therapist.id)}` };
});
after(async () => {
  if (close) await close();
});
export const richText = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
test('therapist can create, retrieve, edit and delete persisted session notes', async () => {
  const created = await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ type: 'private', content: richText('Clinical reflection') })
    .expect(201);
  const id = created.body.note._id;
  const list = await request(app).get(`/api/notes/client/${client.id}`).set(auth).expect(200);
  assert.equal(list.body.notes[0].content.content[0].content[0].text, 'Clinical reflection');
  await request(app)
    .patch(`/api/notes/${id}`)
    .set(auth)
    .send({ type: 'shared', title: 'Agreed reflection' })
    .expect(200);
  const get = await request(app).get(`/api/notes/${id}`).set(auth).expect(200);
  assert.equal(get.body.note.type, 'shared');
  await request(app).delete(`/api/notes/${id}`).set(auth).expect(204);
  await request(app).get(`/api/notes/${id}`).set(auth).expect(404);
});
