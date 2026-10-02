import { randomBytes } from 'node:crypto';
import Therapist from '../models/Therapist.js';
import { HttpError } from '../middleware/errorHandler.js';
export const reservedSlugs = new Set([
  'api',
  'login',
  'register',
  'dashboard',
  'profile',
  'schedule',
  'clients',
  'portal',
  'payments',
  'payment',
  'book',
  'billing',
  'booking',
  'health',
  'admin',
  'www',
  'favicon',
  'assets',
]);
export function normalizeSlug(name) {
  return (
    String(name)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 55) || 'therapist'
  );
}
export async function generateSlug(name) {
  let slug = normalizeSlug(name);
  if (reservedSlugs.has(slug)) slug = `dr-${slug}`;
  for (let i = 0; i < 10; i++) {
    if (!(await Therapist.exists({ slug }))) return slug;
    slug = `${normalizeSlug(name)}-${randomBytes(4).toString('hex')}`;
  }
  throw new HttpError(409, 'Unable to allocate link; please try again');
}
export function validateSlug(value) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
    value.length > 63 ||
    value.length < 3 ||
    reservedSlugs.has(value)
  )
    throw new HttpError(400, 'Use a unique link with 3–63 lowercase letters, numbers and hyphens');
  return true;
}
