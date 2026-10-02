import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { io } from 'socket.io-client';
const root = fileURLToPath(new URL('../', import.meta.url));
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const apiPort = await freePort(),
  webPort = await freePort();
const backend = `http://localhost:${apiPort}`,
  frontend = `http://localhost:${webPort}`;
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const children = [];
let socket;
const run = (args, cwd, env, executable = process.execPath) => {
  const child = spawn(executable, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => {
    log += chunk;
  });
  child.stderr.on('data', (chunk) => {
    log += chunk;
  });
  children.push(child);
  return { child, log: () => log };
};
async function ready(url, processInfo) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (processInfo.child.exitCode !== null)
      throw new Error(`Startup failed: ${processInfo.log()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Startup timed out: ${processInfo.log()}`);
}
try {
  const docker = process.argv.includes('--docker');
  const names = [
    'NODE_ENV',
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'FRONTEND_URL',
    'FRONTEND_URLS',
    'PUBLIC_BASE_URL',
    'TRUST_PROXY_HOPS',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
  ];
  const args = docker
    ? [
        'run',
        '--rm',
        '--network',
        'host',
        ...names.flatMap((name) => ['-e', name]),
        'unfazed:local',
      ]
    : ['unfazed-backend/server.js'];
  const api = run(
    args,
    root,
    {
      NODE_ENV: 'production',
      PORT: String(apiPort),
      MONGO_URI: mongo.getUri(),
      JWT_SECRET: randomBytes(48).toString('hex'),
      FRONTEND_URL: frontend,
      FRONTEND_URLS: '',
      PUBLIC_BASE_URL: frontend,
      TRUST_PROXY_HOPS: '1',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
      RAZORPAY_WEBHOOK_SECRET: '',
    },
    docker ? 'docker' : process.execPath,
  );
  const web = run(
    [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      '--port',
      String(webPort),
      '--host',
      '127.0.0.1',
    ],
    `${root}/unfazed-frontend`,
    { API_PROXY_TARGET: backend },
  );
  await ready(`${backend}/api/ready`, api);
  await ready(frontend, web);
  assert.equal((await fetch(`${frontend}/api/health`)).status, 200);
  assert.equal((await fetch(`${backend}/api/therapists/me`)).status, 401);
  const registered = await fetch(`${frontend}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr Local Smoke',
      email: 'smoke@example.test',
      password: 'Smoke-fixture-password!123',
    }),
  });
  assert.equal(registered.status, 201);
  const { therapist, token } = await registered.json();
  const me = await fetch(`${frontend}/api/therapists/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me.status, 200);
  const html = await (await fetch(`${backend}/${therapist.slug}`)).text();
  assert.match(html, /property="og:title"/);
  assert.match(html, /Dr Local Smoke/);
  const productionIndex = await (await fetch(backend)).text();
  assert.match(productionIndex, /\/assets\/index-/);
  const builtIndex = await readFile(
    new URL('../unfazed-frontend/dist/index.html', import.meta.url),
    'utf8',
  );
  const css = builtIndex.match(/href="([^"]+\.css)"/)[1];
  const stylesheet = await (await fetch(`${backend}${css}`)).text();
  assert.match(stylesheet, /Lato/);
  const font = stylesheet.match(/url\(([^)]+\.woff2)\)/)[1];
  assert.equal((await fetch(`${backend}${font}`)).status, 200);
  const cors = await fetch(`${backend}/api/health`, {
    headers: { Origin: frontend, 'X-Forwarded-For': '203.0.113.10' },
  });
  assert.equal(cors.headers.get('access-control-allow-origin'), frontend);
  const denied = await fetch(`${backend}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  socket = io(frontend, { transports: ['websocket'], timeout: 5000, reconnection: false });
  await Promise.race([
    once(socket, 'connect'),
    once(socket, 'connect_error').then(([error]) => {
      throw error;
    }),
  ]);
  const ack = await socket.timeout(5000).emitWithAck('watch-availability', therapist.slug);
  assert.equal(ack.watching, true);
  console.log(
    'PASS: real API, MongoDB replica set, Vite proxy, auth, branded metadata, production assets, Lato fonts, CORS, proxy headers, and WebSocket proxy.',
  );
} finally {
  socket?.disconnect();
  for (const child of children) {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
  }
  await mongo.stop();
}
