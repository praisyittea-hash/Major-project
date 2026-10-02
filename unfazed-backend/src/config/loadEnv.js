import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
// Resolve relative to this module, independently of the process working directory.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
