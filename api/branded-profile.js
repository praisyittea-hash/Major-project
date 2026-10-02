import { readFile } from 'node:fs/promises';
import { injectProfileMetadata } from '../shared/profileMetadata.js';
export function createHandler({
  readIndex = () =>
    readFile(new URL('../unfazed-frontend/dist/index.html', import.meta.url), 'utf8'),
} = {}) {
  return async function handler(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    const slug = req.query.slug;
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug))
      return res.status(404).end();
    try {
      const api = process.env.VITE_API_BASE_URL;
      if (!api?.startsWith('https://')) throw new Error('API origin required');
      const response = await fetch(`${api.replace(/\/$/, '')}/public/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404) return res.status(404).send('Profile not found');
      if (!response.ok) throw new Error('API unavailable');
      const body = await response.json();
      const therapist = body.therapist || body;
      if (typeof therapist.name !== 'string' || therapist.slug !== slug)
        throw new Error('Invalid profile');
      const html = await readIndex();
      const origin = process.env.PUBLIC_BASE_URL;
      if (!origin?.startsWith('https://')) throw new Error('PUBLIC_BASE_URL required');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      return res.status(200).send(injectProfileMetadata(html, therapist, origin));
    } catch {
      return res.status(503).send('Profile temporarily unavailable. Please try again.');
    }
  };
}
export default createHandler();
