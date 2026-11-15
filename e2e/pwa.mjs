// PWA and GitHub Pages checks (WP13). Usage:
//   node e2e/pwa.mjs [--out DIR] [--port N] [--no-build]
// Builds the Pages variant (base /oh-a-twill) into DIR (default: a fresh temp folder), serves it
// the way GitHub Pages would (scripts/serve-dist.mjs with a base: 404.html for unknown paths),
// and checks in Chromium: sub-path load, deep-link reload, manifest and icons, service worker
// control, offline reload and deep link, quick start → Row done persisting offline, and the
// one-time "Updated" notice after a new version takes over.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/oh-a-twill';

function args() {
  const a = process.argv.slice(2);
  const get = (name) => {
    const i = a.indexOf(name);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    out: resolve(get('--out') ?? mkdtempSync(join(tmpdir(), 'oh-a-twill-pwa-'))),
    port: Number(get('--port') ?? 8113),
    build: !a.includes('--no-build'),
  };
}

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`not ok - ${name}\n  ${String(error?.stack ?? error).split('\n').join('\n  ')}`);
  }
}

async function startServer(dir, port) {
  const child = spawn(process.execPath, [join(ROOT, 'scripts/serve-dist.mjs'), String(port), dir, BASE], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const deadline = Date.now() + 10000;
  while (!out.includes('serving')) {
    if (child.exitCode != null) throw new Error(`server exited: ${out}`);
    if (Date.now() > deadline) throw new Error('server did not start');
    await new Promise((r) => setTimeout(r, 50));
  }
  return async () => {
    if (child.exitCode != null) return;
    child.kill();
    await once(child, 'exit');
  };
}

/** Waits until the app has drawn its first screen. */
async function ready(page) {
  await page.waitForFunction(() => (document.getElementById('root')?.innerText.trim().length ?? 0) > 0, null, { timeout: 15000 });
}

const visible = (page, id) => page.locator(`[data-testid="${id}"]:visible`).first();

async function waitForController(page) {
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15000 });
}

async function main() {
  const opts = args();
  if (opts.build) {
    const run = spawnSync(process.execPath, [join(ROOT, 'scripts/export-web.mjs'), '--base', BASE, '--output-dir', opts.out], { cwd: ROOT, stdio: 'inherit' });
    if (run.status !== 0) throw new Error('export failed');
  }
  const stop = await startServer(opts.out, opts.port);
  const origin = `http://localhost:${opts.port}`;
  const app = `${origin}${BASE}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  // `deepLinks`: the document itself is a 404 (Pages serving 404.html); Chromium logs that.
  const watch = (page, { deepLinks = false } = {}) => {
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (deepLinks && /status of 404/.test(m.text()) && m.location().url === page.url()) return;
      errors.push(`console: ${m.text()} (${m.location().url})`);
    });
  };
  let page = await context.newPage();
  let restoreSw = async () => {};
  watch(page);

  try {
    await step('the app loads at the sub-path', async () => {
      const res = await page.goto(`${app}/`);
      assert.equal(res.status(), 200);
      await ready(page);
      await visible(page, 'stitch-grid').waitFor();
      assert.equal(new URL(page.url()).pathname, `${BASE}/`);
    });

    await step('the bare sub-path redirects to the app', async () => {
      await page.goto(app);
      await ready(page);
      assert.equal(new URL(page.url()).pathname, `${BASE}/`);
    });

    await step('deep links load on a hard reload (served by 404.html)', async () => {
      // A visitor without the service worker yet, so the server (as Pages) answers.
      const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const p = await fresh.newPage();
      watch(p, { deepLinks: true });
      try {
        for (const [path, id] of [
          ['/stitch/twill22', 'favourite-toggle'],
          ['/project/abc', 'project-missing'],
        ]) {
          const res = await p.goto(`${app}${path}`);
          assert.equal(res.status(), 404, 'Pages answers unknown paths with 404.html');
          await ready(p);
          await visible(p, id).waitFor();
          assert.equal(new URL(p.url()).pathname, `${BASE}${path}`);
          await p.reload();
          await ready(p);
          await visible(p, id).waitFor();
        }
      } finally {
        await fresh.close();
      }
    });

    await step('the manifest is valid and its icons resolve', async () => {
      await page.goto(`${app}/`);
      await ready(page);
      const href = await page.locator('link[rel="manifest"]').getAttribute('href');
      assert.equal(href, `${BASE}/manifest.webmanifest`);
      const res = await page.request.get(`${origin}${href}`);
      assert.equal(res.status(), 200);
      const m = JSON.parse(await res.text());
      assert.equal(m.name, 'Oh a Twill');
      assert.ok(m.short_name);
      assert.equal(m.start_url, `${BASE}/`);
      assert.equal(m.scope, `${BASE}/`);
      assert.equal(m.display, 'standalone');
      assert.equal(m.orientation, 'portrait');
      assert.equal(m.background_color, '#FFF3E7');
      assert.equal(m.theme_color, '#FFF3E7');
      const sizes = (purpose) => m.icons.filter((i) => (i.purpose ?? 'any').split(' ').includes(purpose)).map((i) => i.sizes);
      assert.ok(sizes('any').includes('192x192') && sizes('any').includes('512x512'), 'any-purpose 192 and 512 icons');
      assert.ok(sizes('maskable').includes('512x512'), 'maskable 512 icon');
      for (const icon of m.icons) {
        const r = await page.request.get(new URL(icon.src, `${origin}${href}`).href);
        assert.equal(r.status(), 200, icon.src);
        assert.equal(r.headers()['content-type'], 'image/png', icon.src);
        const body = await r.body();
        const [w, h] = [body.readUInt32BE(16), body.readUInt32BE(20)];
        assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} pixel size`);
      }
      const head = await page.evaluate(() => ({
        themes: [...document.querySelectorAll('meta[name="theme-color"]')].map((el) => `${el.getAttribute('media')}=${el.getAttribute('content')}`),
        touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
        capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
        bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content'),
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
      }));
      assert.deepEqual(head.themes, ['(prefers-color-scheme: light)=#FFF3E7', '(prefers-color-scheme: dark)=#17130F']);
      assert.equal((await page.request.get(`${origin}${head.touch}`)).status(), 200, 'apple-touch-icon');
      assert.equal(head.capable, 'yes');
      assert.ok(head.bar);
      assert.match(head.viewport, /viewport-fit=cover/);
    });

    await step('the service worker registers and controls the page', async () => {
      await waitForController(page);
      const sw = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return { scope: reg.scope, script: reg.active?.scriptURL };
      });
      assert.equal(sw.scope, `${app}/`);
      assert.equal(sw.script, `${app}/sw.js`);
      // Precaching finished before activation, so every shell file is in the cache.
      const cached = await page.evaluate(async () => {
        const keys = await caches.keys();
        const cache = await caches.open(keys.find((k) => k.startsWith('oh-a-twill-')));
        return (await cache.keys()).map((r) => new URL(r.url).pathname);
      });
      const scripts = await page.evaluate(() => [...document.scripts].map((s) => new URL(s.src).pathname).filter(Boolean));
      for (const p of [`${BASE}/index.html`, `${BASE}/manifest.webmanifest`, ...scripts]) assert.ok(cached.includes(p), `${p} precached`);
      assert.ok(cached.some((p) => p.endsWith('.ttf')), 'fonts precached');
    });

    let projectPath = '';
    await step('quick start → Row done (online)', async () => {
      await page.goto(`${app}/`);
      await ready(page);
      await waitForController(page);
      await page.getByRole('button', { name: 'Start weaving', exact: true }).locator('visible=true').first().click();
      await visible(page, 'guide-next').waitFor();
      projectPath = new URL(page.url()).pathname;
      assert.match(projectPath, new RegExp(`^${BASE}/project/[^/]+$`));
      assert.match(await visible(page, 'guide-row').innerText(), /\b1\b/);
    });

    await step('offline: reload, deep links and Row done still work', async () => {
      await context.setOffline(true);
      await page.reload();
      await ready(page);
      await visible(page, 'guide-next').click();
      await page.waitForFunction(() => /\b2\b/.test(document.querySelector('[data-testid="guide-row"]')?.textContent ?? ''));
      // Reload offline: the row survived (saved on the device) and the shell came from the cache.
      await page.reload();
      await ready(page);
      assert.match(await visible(page, 'guide-row').innerText(), /\b2\b/);
      assert.equal(new URL(page.url()).pathname, projectPath);
      // A deep link never visited before, typed in while offline.
      await page.goto(`${app}/stitch/plain`);
      await ready(page);
      await visible(page, 'favourite-toggle').waitFor();
      await page.goto(`${app}/`);
      await ready(page);
      await visible(page, 'stitch-grid').waitFor();
      await context.setOffline(false);
    });

    await step('a new version takes over on the next launch and says "Updated" once', async () => {
      await context.setOffline(false);
      assert.equal(await visible(page, 'update-notice').count(), 0, 'no notice on first install');
      // Publish a "new version": same files, different version id.
      const swPath = join(opts.out, 'sw.js');
      const sw = await readFile(swPath, 'utf8');
      const next = sw.replace(/"version":"([^"]+)"/, (_, v) => `"version":"${v}-next"`);
      assert.notEqual(next, sw);
      await writeFile(swPath, next);
      restoreSw = () => writeFile(swPath, sw);
      // An open page finds the update; it installs and waits while the old version runs.
      const waiting = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg.update();
        const w = reg.installing || reg.waiting;
        if (w && w.state !== 'installed') await new Promise((r) => w.addEventListener('statechange', () => w.state === 'installed' && r()));
        return !!reg.waiting;
      });
      assert.ok(waiting, 'new version waits while the app is open');
      await page.reload();
      await ready(page);
      assert.equal(await visible(page, 'update-notice').count(), 0, 'still the old version while a tab stays open');
      // Close the app, launch it again: the new version is in charge and says so once.
      await page.close();
      await new Promise((r) => setTimeout(r, 500));
      page = await context.newPage();
      watch(page);
      await page.goto(`${app}/`);
      await ready(page);
      await visible(page, 'update-notice').waitFor({ timeout: 10000 });
      const keys = await page.evaluate(() => caches.keys());
      assert.equal(keys.filter((k) => k.startsWith('oh-a-twill-')).length, 1, 'old cache deleted');
      await visible(page, 'update-notice').click();
      await visible(page, 'update-notice').waitFor({ state: 'detached' });
      await page.reload();
      await ready(page);
      await page.waitForTimeout(1000);
      assert.equal(await visible(page, 'update-notice').count(), 0, 'the notice shows only once');
    });

    await step('no page errors', async () => {
      // Offline reloads log failed fetches for nothing: the app makes no network calls.
      assert.deepEqual(errors, []);
    });
  } finally {
    await restoreSw(); // leave the build as exported (e.g. for a --no-build rerun)
    await browser.close();
    await stop();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall PWA checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
