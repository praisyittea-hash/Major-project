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
