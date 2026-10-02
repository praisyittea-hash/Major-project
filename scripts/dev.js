import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const options = { cwd: root, stdio: 'inherit', detached: process.platform !== 'win32' };
const children = [
  spawn(process.execPath, ['unfazed-backend/server.js'], options),
  spawn('npm', ['run', 'dev:web'], options),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* child already exited */
    }
  }
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code, signal) => stop(signal ? 0 : code || 0));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
