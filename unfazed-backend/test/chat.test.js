import request from 'supertest';
import ChatMessage from '../src/models/ChatMessage.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import { database } from './helpers.js';
import { app } from '../src/app.js';
import { attachSchedulingSocket } from '../src/sockets/schedulingSocket.js';
import { attachChatSocket } from '../src/sockets/chatSocket.js';
import Therapist from '../src/models/Therapist.js';
import Client from '../src/models/Client.js';
import { issueToken } from '../src/services/tokenService.js';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-chat-test-secret-never-for-production';
let close, server, io, therapist, client, url;
before(async () => {
  close = await database();
  therapist = await Therapist.create({
    name: 'Chat Therapist',
    email: 'chat@example.test',
    password_hash: 'fixture',
  });
  client = await Client.create({
    therapist: therapist.id,
    name: 'Chat Client',
    email: 'chatclient@example.test',
  });
  await ChatMessage.init();
  server = createServer(app);
  io = attachSchedulingSocket(server);
  attachChatSocket(io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/chat`;
});
after(async () => {
  if (io) await new Promise((resolve) => io.close(resolve));
  if (close) await close();
});
function socket(token) {
  return connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
}
async function connected(socket) {
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}
const clientToken = () => issueToken(client.id, 'client', { therapistId: therapist.id });
test('dedicated chat namespace requires a current therapist/client JWT', async () => {
  for (const token of ['invalid', issueToken('000000000000000000000001', 'booking')]) {
    const bad = socket(token);
    try {
      const error = await new Promise((resolve) => bad.once('connect_error', resolve));
      assert.match(error.message, /authentication/);
    } finally {
      bad.disconnect();
    }
  }
  const therapistSocket = socket(issueToken(therapist.id)),
    clientSocket = socket(clientToken());
  try {
    await Promise.all([connected(therapistSocket), connected(clientSocket)]);
    assert.ok(therapistSocket.connected && clientSocket.connected);
  } finally {
    therapistSocket.disconnect();
    clientSocket.disconnect();
  }
});
test('only the owning therapist and client can join a conversation; messages arrive in both directions', async () => {
  const a = socket(issueToken(therapist.id)),
    b = socket(clientToken());
  const outsider = await Therapist.create({
    name: 'Outsider',
    email: 'outsider@example.test',
    password_hash: 'fixture',
  });
  const c = socket(issueToken(outsider.id));
  try {
    await Promise.all([connected(a), connected(b), connected(c)]);
    for (const s of [a, b])
      assert.equal(
        (await s.timeout(3000).emitWithAck('chat:join', { clientId: client.id })).ok,
        true,
      );
    assert.equal(
      (await c.timeout(3000).emitWithAck('chat:join', { clientId: client.id })).ok,
      false,
    );
    assert.equal(
      (await b.timeout(3000).emitWithAck('chat:join', { clientId: outsider.id })).ok,
      false,
    );
    for (const [sender, receiver, text] of [
      [a, b, 'Hello from therapist'],
      [b, a, 'Hello from client'],
    ]) {
      const received = new Promise((resolve) => receiver.once('chat:message', resolve));
      const result = await sender.timeout(3000).emitWithAck('chat:send', {
        clientId: client.id,
        text,
        clientMessageId: crypto.randomUUID(),
      });
      assert.equal(result.ok, true);
      assert.equal((await received).text, text);
    }
    assert.equal(
      (await c.timeout(3000).emitWithAck('chat:send', { clientId: client.id, text: 'Intrusion' }))
        .ok,
      false,
    );
    assert.equal(
      (await a.timeout(3000).emitWithAck('chat:send', { clientId: client.id, text: '' })).ok,
      false,
    );
  } finally {
    a.disconnect();
    b.disconnect();
    c.disconnect();
  }
});

test('reconnecting clients load persisted message history; retry IDs cannot duplicate or alter a message', async () => {
  const a = socket(issueToken(therapist.id));
  try {
    await connected(a);
    const payload = {
      clientId: client.id,
      text: 'Survives refresh',
      clientMessageId: crypto.randomUUID(),
    };
    const first = await a.timeout(3000).emitWithAck('chat:send', payload);
    const second = await a.timeout(3000).emitWithAck('chat:send', payload);
    assert.equal(first.ok, true);
    assert.equal(first.message._id, second.message._id);
    assert.equal(
      (await a.timeout(3000).emitWithAck('chat:send', { ...payload, text: 'Tampered retry' })).ok,
      false,
    );
    assert.equal(await ChatMessage.countDocuments({ clientMessageId: payload.clientMessageId }), 1);
  } finally {
    a.disconnect();
  }
  for (const token of [issueToken(therapist.id), clientToken()]) {
    const reconnected = socket(token);
    await connected(reconnected);
    reconnected.disconnect();
    const response = await request(app)
      .get(`/api/chat/${client.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.ok(response.body.messages.some((message) => message.text === 'Survives refresh'));
  }
  await request(app).get(`/api/chat/${client.id}/messages`).expect(401);
  await request(app)
    .get(`/api/chat/${therapist.id}/messages`)
    .set('Authorization', `Bearer ${clientToken()}`)
    .expect(403);
});
test('typing is scoped to the peer and read receipts persist only on peer messages', async () => {
  const a = socket(issueToken(therapist.id)),
    b = socket(clientToken());
  try {
    await Promise.all([connected(a), connected(b)]);
    for (const s of [a, b]) await s.timeout(3000).emitWithAck('chat:join', { clientId: client.id });
    const typing = new Promise((resolve) => b.once('chat:typing', resolve));
    await a.timeout(3000).emitWithAck('chat:typing', { clientId: client.id, typing: true });
    assert.equal((await typing).typing, true);
    const sent = await a.timeout(3000).emitWithAck('chat:send', {
      clientId: client.id,
      text: 'Read receipt fixture',
      clientMessageId: crypto.randomUUID(),
    });
    const receipt = new Promise((resolve) => a.once('chat:read', resolve));
    assert.equal(
      (
        await b
          .timeout(3000)
          .emitWithAck('chat:read', { clientId: client.id, messageId: sent.message._id })
      ).ok,
      true,
    );
    assert.equal((await receipt).readerRole, 'client');
    assert.ok((await ChatMessage.findById(sent.message._id)).readAt);
    assert.equal(
      (
        await b
          .timeout(3000)
          .emitWithAck('chat:read', { clientId: client.id, messageId: therapist.id })
      ).ok,
      false,
    );
  } finally {
    a.disconnect();
    b.disconnect();
  }
});
