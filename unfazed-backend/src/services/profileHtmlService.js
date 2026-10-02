import { readFile } from 'node:fs/promises';
import { injectProfileMetadata } from '../../../shared/profileMetadata.js';
export async function profileHtml(therapist) {
  let html;
  try {
    html = await readFile(
      new URL('../../../unfazed-frontend/dist/index.html', import.meta.url),
      'utf8',
    );
  } catch {
    html = await readFile(new URL('../../../unfazed-frontend/index.html', import.meta.url), 'utf8');
  }
  return injectProfileMetadata(
    html,
    therapist,
    process.env.PUBLIC_BASE_URL || 'http://localhost:5173',
  );
}
