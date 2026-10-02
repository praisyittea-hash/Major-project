import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

export function updateEnv(text, values) {
  const pending = new Map(Object.entries(values));
  const lines = text.split('\n').map((line) => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)?.[1];
    if (!pending.has(key)) return line;
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${quote(value)}`;
  });
  for (const [key, value] of pending) lines.push(`${key}=${quote(value)}`);
  return `${lines.join('\n').trim()}\n`;
}
function quote(value) {
  if (/[\r\n\0]/.test(value))
    throw new Error('Environment values cannot contain control characters');
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  throw new Error('Use URL-encoded credentials; values cannot contain both quote styles');
}
export async function runSetup({ root, input = process.stdin, output = process.stdout }) {
  const terminal = Boolean(input.isTTY && output.isTTY);
  let masked = false;
  const sink = new Writable({
    write(chunk, _encoding, done) {
      if (!masked) output.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input, output: sink, terminal });
  const lines = rl[Symbol.asyncIterator]();
  async function ask(label, fallback = '', secret = false) {
    output.write(
      `${label}${fallback ? (secret ? ' [Enter to keep existing]' : ` [${fallback}]`) : ''}: `,
    );
    masked = secret && terminal;
    const answer = await lines.next();
    masked = false;
    if (secret && terminal) output.write('\n');
    if (answer.done) throw new Error('Setup cancelled: missing input');
    return answer.value.trim() || fallback;
  }
  async function existing(path) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw error;
    }
  }
  const backendPath = resolve(root, 'unfazed-backend/.env');
  const frontendPath = resolve(root, 'unfazed-frontend/.env');
  const backendText = await existing(backendPath),
    frontendText = await existing(frontendPath);
  const current = dotenv.parse(backendText);
  try {
    const target = await ask('Target: local, railway, render, or vercel', 'local');
    if (!['local', 'railway', 'render', 'vercel'].includes(target))
      throw new Error('Unknown deployment target');
    const mongo = await ask(
      'MongoDB replica-set / Atlas URI (hidden)',
      current.MONGO_URI || '',
      true,
    );
    if (!/^mongodb(?:\+srv)?:\/\//.test(mongo)) throw new Error('A MongoDB URI is required');
    const jwt =
      (await ask('JWT secret (hidden; blank generates one)', current.JWT_SECRET || '', true)) ||
      randomBytes(48).toString('hex');
    if (jwt.length < 32 || jwt.startsWith('replace-'))
      throw new Error('JWT secret must have at least 32 characters');
    const port = await ask('Local API port (cloud providers set PORT)', current.PORT || '5000');
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) throw new Error('Invalid port');
    const origin = await ask(
      'Frontend public origin',
      target === 'local' ? 'http://localhost:5173' : current.FRONTEND_URL || '',
    );
    const originUrl = new URL(origin);
    if (
      originUrl.origin !== origin ||
      !['http:', 'https:'].includes(originUrl.protocol) ||
      (target !== 'local' && originUrl.protocol !== 'https:')
    )
      throw new Error('Enter an origin without a trailing slash; cloud origins require HTTPS');
    let api = '/api';
    if (target === 'vercel') {
      const backend = await ask('Railway / Render backend HTTPS origin');
      const url = new URL(backend);
      if (url.protocol !== 'https:' || url.origin !== backend)
        throw new Error('Backend must be an HTTPS origin without a trailing slash');
      api = `${backend}/api`;
    }
    const enabled = await ask(
      'Enable Razorpay test payments? yes/no',
      current.RAZORPAY_KEY_ID ? 'yes' : 'no',
    );
    if (!['yes', 'no'].includes(enabled)) throw new Error('Answer yes or no');
    let key = '',
      secret = '',
      webhook = '';
    if (enabled === 'yes') {
      key = await ask('Razorpay TEST key ID', current.RAZORPAY_KEY_ID || '');
      secret = await ask('Razorpay key secret (hidden)', current.RAZORPAY_KEY_SECRET || '', true);
      webhook = await ask(
        'Razorpay webhook secret (hidden)',
        current.RAZORPAY_WEBHOOK_SECRET || '',
        true,
      );
      if (!key.startsWith('rzp_test_') || !secret || webhook.length < 20)
        throw new Error('Test key, secret, and webhook secret (20+ characters) required');
    }
    const backendValues = {
      PORT: port,
      MONGO_URI: mongo,
      JWT_SECRET: jwt,
      FRONTEND_URL: origin,
      FRONTEND_URLS: '',
      PUBLIC_BASE_URL: origin,
      NODE_ENV: target === 'local' ? 'development' : 'production',
      TRUST_PROXY_HOPS: target === 'local' ? '0' : '1',
      RAZORPAY_KEY_ID: key,
      RAZORPAY_KEY_SECRET: secret,
      RAZORPAY_WEBHOOK_SECRET: webhook,
    };
    const frontendValues = {
      VITE_API_BASE_URL: api,
      VITE_RAZORPAY_KEY_ID: key,
      API_PROXY_TARGET: `http://localhost:${port}`,
      PUBLIC_BASE_URL: origin,
    };
    // Validate both outputs before writing. Unknown variables and comments are preserved.
    const files = [
      [backendPath, updateEnv(backendText, backendValues)],
      [frontendPath, updateEnv(frontendText, frontendValues)],
    ];
    for (const [path, content] of files) {
      await mkdir(resolve(path, '..'), { recursive: true });
      const temp = `${path}.setup-${randomBytes(6).toString('hex')}`;
      await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
      await rename(temp, path);
    }
    output.write(
      'Saved private backend and public frontend environment files. No secrets were printed.\n',
    );
    output.write(
      target === 'local'
        ? 'Run npm run dev. MongoDB must already be reachable.\n'
        : 'Copy the corresponding values into your provider environment settings; see docs/DEPLOYMENT.md.\n',
    );
  } finally {
    rl.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSetup({ root: fileURLToPath(new URL('../', import.meta.url)) }).catch(() => {
    // Do not echo an invalid URL or credentials inside an error message.
    console.error('Setup failed or was cancelled. Check your answers and rerun npm run setup.');
    process.exitCode = 1;
  });
}
