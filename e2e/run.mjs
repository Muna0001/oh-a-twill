// npm run e2e: export the web build (or use E2E_DIST), serve it, run e2e/*.test.mjs, stop.
//   E2E_DIST=<dir>       use an existing export instead of building one
//   E2E_PORT=<port>      default 8112
//   E2E_BROWSERS=a,b     default chromium,webkit (a browser that will not launch is skipped)
// e2e/pwa.* belongs to the PWA work package and runs on its own.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ROOT, startServer } from './lib.mjs';

const port = Number(process.env.E2E_PORT || 8112);
let dist = process.env.E2E_DIST;
let tempDir = null;
if (!dist) {
  tempDir = mkdtempSync(join(tmpdir(), 'oh-a-twill-e2e-'));
  dist = join(tempDir, 'dist');
  console.log(`# exporting the web build to ${dist}`);
  const out = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_OFFLINE: '1', CI: '1', EXPO_BASE_URL: '' },
  });
  if (out.status !== 0) {
    console.error('expo export failed');
    process.exit(out.status ?? 1);
  }
}

const files = readdirSync(join(ROOT, 'e2e'))
  .filter((f) => f.endsWith('.test.mjs') && !f.startsWith('pwa.'))
  .sort()
  .map((f) => join(ROOT, 'e2e', f));
const only = process.argv.slice(2);

const server = await startServer(dist, port);
console.log(`# serving ${dist} at ${server.url}`);
let code = 1;
try {
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...(only.length ? only : files)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, E2E_URL: server.url },
  });
  code = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)));
} finally {
  await server.stop();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
process.exit(code);
