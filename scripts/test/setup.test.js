import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import dotenv from 'dotenv';
import { runSetup, updateEnv } from '../setup.js';
import { allowedOrigins, proxyHops } from '../../unfazed-backend/src/config/http.js';
import { injectProfileMetadata } from '../../shared/profileMetadata.js';

test('setup writes private secrets, excludes them from frontend/output, and preserves custom values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unfazed-setup-'));
  let output = '';
  const sink = new Writable({
    write(chunk, _enc, cb) {
      output += chunk;
      cb();
    },
  });
  const input = Readable.from(
    'local\nmongodb://127.0.0.1/fixture?replicaSet=rs0\n\n5001\nhttp://localhost:5173\nyes\nrzp_test_fixture\nfixture-private-key\nfixture-webhook-secret-123456\n',
  );
  try {
    await runSetup({ root, input, output: sink });
    const backend = dotenv.parse(await readFile(join(root, 'unfazed-backend/.env')));
    const frontendText = await readFile(join(root, 'unfazed-frontend/.env'), 'utf8');
    assert.equal(backend.JWT_SECRET.length, 96);
    assert.equal(backend.RAZORPAY_KEY_SECRET, 'fixture-private-key');
    assert.equal((await stat(join(root, 'unfazed-backend/.env'))).mode & 0o777, 0o600);
    for (const value of [
      backend.JWT_SECRET,
      backend.MONGO_URI,
      backend.RAZORPAY_KEY_SECRET,
      backend.RAZORPAY_WEBHOOK_SECRET,
    ]) {
      assert.ok(!frontendText.includes(value));
      assert.ok(!output.includes(value));
    }
    assert.match(frontendText, /API_PROXY_TARGET='http:\/\/localhost:5001'/);
    assert.equal(
      updateEnv('# retained\nCUSTOM=hello\nJWT_SECRET=old\n', { JWT_SECRET: 'new' }),
      "# retained\nCUSTOM=hello\nJWT_SECRET='new'\n",
    );
    assert.throws(() => updateEnv('', { JWT_SECRET: 'bad\nINJECTION=true' }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('explicit origins and limited proxy hops', () => {
  assert.deepEqual(
    allowedOrigins({ FRONTEND_URLS: 'https://practice.example,https://portal.example' }),
    ['https://practice.example', 'https://portal.example'],
  );
  assert.equal(proxyHops({ NODE_ENV: 'production' }), 1);
  assert.equal(proxyHops({}), 0);
  assert.throws(() => proxyHops({ TRUST_PROXY_HOPS: 'true' }));
});
test('shared metadata escapes profile values and uses deployment canonical origin', () => {
  const html = injectProfileMetadata(
    '<head><title>App</title></head>',
    { name: '<script>x</script>', bio: '"private" & care', slug: 'dr-fixture' },
    'https://practice.example/',
  );
  assert.ok(!html.includes('<script>'));
  assert.match(html, /https:\/\/practice.example\/dr-fixture/);
  assert.match(html, /&quot;private&quot; &amp; care/);
});

test('Vercel setup requires HTTPS split origins and rerunning retains secrets and custom configuration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unfazed-vercel-'));
  const sink = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  try {
    await runSetup({
      root,
      input: Readable.from(
        'vercel\nmongodb+srv://fixture.example/test\n\n5000\nhttps://portal.example\nhttps://api.example\nno\n',
      ),
      output: sink,
    });
    const path = join(root, 'unfazed-backend/.env');
    const before = dotenv.parse(await readFile(path));
    const frontend = dotenv.parse(await readFile(join(root, 'unfazed-frontend/.env')));
    assert.equal(frontend.VITE_API_BASE_URL, 'https://api.example/api');
    assert.equal(before.TRUST_PROXY_HOPS, '1');
    assert.equal(before.NODE_ENV, 'production');
    assert.equal(before.FRONTEND_URLS, '');
    await runSetup({
      root,
      input: Readable.from('vercel\n\n\n\n\nhttps://api.example\nno\n'),
      output: sink,
    });
    const after = dotenv.parse(await readFile(path));
    assert.equal(after.JWT_SECRET, before.JWT_SECRET);
    assert.equal(after.MONGO_URI, before.MONGO_URI);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
