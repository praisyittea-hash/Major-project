import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../api/branded-profile.js';
const handler = createHandler({
  readIndex: async () =>
    '<head><title>App</title><script src="/assets/index-fixture.js"></script></head>',
});
function response() {
  return {
    code: 0,
    headers: {},
    body: '',
    status(code) {
      this.code = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end() {
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}
test('Vercel metadata function fetches only public API and uses its own frontend assets', async () => {
  const originalFetch = globalThis.fetch;
  const originalApi = process.env.VITE_API_BASE_URL,
    originalBase = process.env.PUBLIC_BASE_URL;
  process.env.VITE_API_BASE_URL = 'https://api.example/api';
  process.env.PUBLIC_BASE_URL = 'https://practice.example';
  try {
    globalThis.fetch = async (url) => {
      assert.equal(url, 'https://api.example/api/public/dr-fixture');
      return new Response(
        JSON.stringify({ therapist: { name: 'Dr Fixture', bio: 'Care', slug: 'dr-fixture' } }),
        { status: 200 },
      );
    };
    const res = response();
    await handler({ method: 'GET', query: { slug: 'dr-fixture' } }, res);
    assert.equal(res.code, 200);
    assert.match(res.body, /og:title/);
    assert.match(res.body, /https:\/\/practice.example\/dr-fixture/);
    assert.match(res.body, /\/assets\/index-/);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    const invalid = response();
    await handler({ method: 'GET', query: { slug: '../private' } }, invalid);
    assert.equal(invalid.code, 404);
    globalThis.fetch = async () => new Response('', { status: 404 });
    const missing = response();
    await handler({ method: 'GET', query: { slug: 'missing' } }, missing);
    assert.equal(missing.code, 404);
    globalThis.fetch = async () => {
      throw new Error('Offline');
    };
    const outage = response();
    await handler({ method: 'GET', query: { slug: 'dr-fixture' } }, outage);
    assert.equal(outage.code, 503);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApi === undefined) delete process.env.VITE_API_BASE_URL;
    else process.env.VITE_API_BASE_URL = originalApi;
    if (originalBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalBase;
  }
});
