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
test('note ownership is enforced for every operation and foreign references cannot be attached', async () => {
  const other = await Therapist.create({
    name: 'Other Therapist',
    email: 'other@example.test',
    password_hash: 'fixture',
  });
  const stranger = { Authorization: `Bearer ${issueToken(other.id)}` };
  const clientAuth = {
    Authorization: `Bearer ${issueToken(client.id, 'client', { therapistId: therapist.id })}`,
  };
  const created = await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ content: richText('Owned note') })
    .expect(201);
  const path = `/api/notes/${created.body.note._id}`;
  await request(app).get(path).expect(401);
  await request(app).get(path).set({ Authorization: 'Bearer invalid' }).expect(401);
  await request(app).get(path).set(clientAuth).expect(403);
  await request(app).get(path).set(stranger).expect(404);
  await request(app).patch(path).set(stranger).send({ title: 'Intrusion' }).expect(404);
  await request(app).delete(path).set(stranger).expect(404);
  await request(app).get(`/api/notes/client/${client.id}`).set(stranger).expect(404);
  await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(stranger)
    .send({ content: richText('Intrusion') })
    .expect(404);
  await request(app).patch(path).set(auth).send({ client: other.id }).expect(400);
  await request(app).patch(path).set(auth).send({ session: other.id }).expect(404);
  for (const content of [
    { type: 'script' },
    {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'X',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        },
      ],
    },
    'html',
    null,
  ]) {
    await request(app)
      .post(`/api/notes/client/${client.id}`)
      .set(auth)
      .send({ content })
      .expect(400);
  }
  await request(app).patch(path).set(auth).send({}).expect(400);
  await request(app).patch(path).set(clientAuth).send({ title: 'Client edit' }).expect(403);
});
test('direct client-facing notes and history APIs return shared content and never private content', async () => {
  const clientAuth = {
    Authorization: `Bearer ${issueToken(client.id, 'client', { therapistId: therapist.id })}`,
  };
  for (const [type, text] of [
    ['private', 'This is private therapist information.'],
    ['shared', 'This information is safe for the client.'],
  ]) {
    await request(app)
      .post(`/api/notes/client/${client.id}`)
      .set(auth)
      .send({ type, content: richText(text) })
      .expect(201);
  }
  for (const path of ['/api/portal/notes', '/api/portal/history']) {
    const response = await request(app).get(path).set(clientAuth).expect(200);
    assert.ok(response.text.includes('This information is safe for the client.'));
    assert.ok(!response.text.includes('This is private therapist information.'));
    assert.ok(!response.text.includes('privateContent'));
    assert.ok(response.body.notes.every((note) => note.type === 'shared'));
    await request(app).get(path).expect(401);
    await request(app).get(path).set(auth).expect(403);
    const wrongTenant = {
      Authorization: `Bearer ${issueToken(client.id, 'client', { therapistId: client.id })}`,
    };
    await request(app).get(path).set(wrongTenant).expect(403);
  }
  const unrelated = await Client.create({
    therapist: therapist.id,
    name: 'Unrelated Client',
    email: 'unrelated@example.test',
  });
  const ownOnly = await request(app)
    .get(`/api/portal/notes?client=${client.id}`)
    .set({
      Authorization: `Bearer ${issueToken(unrelated.id, 'client', { therapistId: therapist.id })}`,
    })
    .expect(200);
  assert.deepEqual(ownOnly.body.notes, []);
});
test('SOAP template persists validated structured fields and can be shared with its client', async () => {
  const content = {
    subjective: 'Client report',
    objective: 'Observation',
    assessment: 'Working assessment',
    plan: 'Agreed plan',
  };
  const created = await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ type: 'shared', format: 'soap', content })
    .expect(201);
  assert.deepEqual(created.body.note.content, content);
  await request(app)
    .patch(`/api/notes/${created.body.note._id}`)
    .set(auth)
    .send({ content: { ...content, plan: 'Updated plan' } })
    .expect(200);
  await request(app)
    .post(`/api/notes/client/${client.id}`)
    .set(auth)
    .send({ format: 'soap', content: { subjective: 'Missing fields' } })
    .expect(400);
  await request(app)
    .patch(`/api/notes/${created.body.note._id}`)
    .set(auth)
    .send({ format: 'freeform' })
    .expect(400);
});
