import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
test(
  'actual backend entrypoint starts with an isolated replica set and shuts down cleanly',
  { timeout: 30000 },
  async () => {
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const child = spawn(process.execPath, ['server.js'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        MONGO_URI: mongo.getUri(),
        JWT_SECRET: 'isolated-startup-test-secret-never-production',
        RAZORPAY_KEY_ID: '',
        RAZORPAY_KEY_SECRET: '',
        RAZORPAY_WEBHOOK_SECRET: '',
        EMAIL_ENABLED: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const exited = once(child, 'exit');
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/ready`);
          if (response.status === 200) {
            ready = true;
            break;
          }
        } catch {
          /* startup not yet listening */
        }
        if (child.exitCode !== null) break;
        await delay(100);
      }
      assert.ok(ready, output);
      assert.equal((await fetch(`http://127.0.0.1:${port}/api/analytics`)).status, 401);
      child.kill('SIGTERM');
      const [code] = await exited;
      assert.equal(code, 0, output);
    } finally {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await exited;
      }
      await mongo.stop();
    }
  },
);
