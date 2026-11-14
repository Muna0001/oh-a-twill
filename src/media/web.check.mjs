// Runs the real web implementation (picture.web.ts) in Chromium and checks the
// whole flow on assets/samples/flower.png. Not a Jest test:
//
//   node src/media/web.check.mjs
//
// Nothing is bundled. Playwright answers every request itself: TypeScript
// sources are transpiled on the fly (types stripped, nothing else), with
// `.web.ts` preferred the way Metro prefers it for the web build.
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ts = require('typescript');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = 'http://media.check';
// Imported inside the page, where the route handler below serves it.
const ENTRY = '/src/media/index';

function sourceFor(pathname) {
  const base = join(ROOT, pathname);
  for (const candidate of [`${base}.web.ts`, `${base}.ts`, base]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const HTML = `<!doctype html><meta charset="utf-8"><title>media check</title>
<script type="importmap">{ "imports": { "@/": "/src/" } }</script><body></body>`;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: HTML });
    // A folder import: re-export its index so relative imports inside it resolve.
    const asFolder = join(ROOT, url.pathname);
    if (existsSync(asFolder) && statSync(asFolder).isDirectory()) {
      return route.fulfill({ contentType: 'text/javascript', body: `export * from '${url.pathname.replace(/\/$/, '')}/index';` });
    }
    const file = sourceFor(url.pathname);
    if (!file) {
      console.log(`404 ${url.pathname}`);
      return route.fulfill({ status: 404, body: 'not found' });
    }
    if (file.endsWith('.ts')) {
      const js = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
        fileName: file,
      }).outputText;
      return route.fulfill({ contentType: 'text/javascript', body: js });
    }
    return route.fulfill({ contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream', body: readFileSync(file) });
  });

  const page = await context.newPage();
  page.on('console', (message) => message.type() === 'error' && console.log(`console: ${message.text()}`));
  page.on('pageerror', (error) => check('no page errors', false, String(error)));
  await page.goto(`${ORIGIN}/`);

  const r = await page.evaluate(async (entry) => {
    const media = await import(entry);
    const code = async (promise) => {
      try {
        await promise;
        return 'ok';
      } catch (error) {
        return error instanceof media.PictureError ? error.code : `other: ${error}`;
      }
    };
    const out = {};
    const flower = await (await fetch('/assets/samples/flower.png')).blob();

    // Import (the drag and drop path).
    const picked = await media.importPictureFile(flower);
    out.picked = picked;
    const stored = await new Promise((res, rej) => {
      const open = indexedDB.open('oh-a-twill');
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const get = open.result.transaction('pictures').objectStore('pictures').get(picked.uri.slice(4));
        get.onsuccess = () => res(get.result);
        get.onerror = () => rej(get.error);
      };
    });
    out.stored = { isBlob: stored instanceof Blob, type: stored?.type, size: stored?.size };

    // Build at 24 warps, rows from the picture's shape.
    const params = { imageUri: picked.uri, imageW: picked.width, imageH: picked.height, warps: 24, rows: 0, k: 5, tidy: true };
    const pic = await media.buildPicture(params);
    out.pic = { W: pic.W, H: pic.H, autoH: pic.autoH, cells: pic.grid.length, palette: pic.palette, grid: Array.from(pic.grid) };

    // The cache: count canvas reads while only k / tidy change, then change the rows.
    let reads = 0;
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      reads++;
      return getImageData.apply(this, args);
    };
    const k3 = await media.buildPicture({ ...params, k: 3, tidy: false });
    out.readsSameSize = reads;
    out.k3 = k3.palette.length;
    const rows12 = await media.buildPicture({ ...params, rows: 12 });
    out.readsNewRows = reads;
    out.rows12 = { H: rows12.H, autoH: rows12.autoH, cells: rows12.grid.length };
    CanvasRenderingContext2D.prototype.getImageData = getImageData;

    // The same pixels as the reference's processPic, drawn by hand here.
    const px = await media.samplePicture(picked.uri, 24, 30);
    const img = new Image();
    const thumb = await media.thumbnailSource(picked.uri);
    out.thumb = thumb.slice(0, 5);
    out.thumbStable = (await media.thumbnailSource(picked.uri)) === thumb;
    img.src = thumb;
    await img.decode();
    out.thumbSize = [img.naturalWidth, img.naturalHeight];
    const f = 4, cw = 24 * f, ch = 30 * f;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const x = cv.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, cw, ch);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, cw, ch);
    const d = x.getImageData(0, 0, cw, ch).data;
    let maxDiff = 0;
    for (let yy = 0; yy < 30; yy++) for (let xx = 0; xx < 24; xx++) {
      let rr = 0, g = 0, b = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const i = ((yy * f + dy) * cw + xx * f + dx) * 4; rr += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const o = (yy * 24 + xx) * 3, q = f * f;
      maxDiff = Math.max(maxDiff, Math.abs(px[o] - Math.fround(rr / q)), Math.abs(px[o + 1] - Math.fround(g / q)), Math.abs(px[o + 2] - Math.fround(b / q)));
    }
    out.sampleLength = px.length;
    out.maxDiffFromReference = maxDiff;

    // Transparency is painted onto white, and big pictures are shrunk to 1024.
    const big = document.createElement('canvas'); big.width = 2400; big.height = 1200;
    const clear = await new Promise((res) => big.toBlob(res, 'image/png'));
    const bigPicked = await media.importPictureFile(clear);
    out.big = { width: bigPicked.width, height: bigPicked.height };
    const white = await media.samplePicture(bigPicked.uri, 4, 4);
    out.clearIsWhite = Array.from(white).every((v) => v === 255);

    // A data URL, as the legacy import passes in.
    const small = document.createElement('canvas'); small.width = 32; small.height = 20;
    const sx = small.getContext('2d'); sx.fillStyle = '#2E4C8F'; sx.fillRect(0, 0, 32, 20);
    const legacy = await media.importPictureDataUrl(small.toDataURL('image/jpeg', 0.9));
    out.legacy = { uri: legacy.uri.slice(0, 4), width: legacy.width, height: legacy.height };

    // Errors.
    out.notImage = await code(media.importPictureFile(new Blob(['hello'], { type: 'text/plain' })));
    out.broken = await code(media.importPictureFile(new Blob(['hello'], { type: 'image/png' })));
    out.badDataUrl = await code(media.importPictureDataUrl('data:text/plain;base64,aGVsbG8='));
    out.missing = await code(media.buildPicture({ ...params, imageUri: 'idb:nope' }));
    out.messages = [media.messageFor(new media.PictureError('not-image')), media.messageFor(new Error('x'))];

    // Delete.
    await media.deletePicture(picked.uri);
    out.afterDelete = await code(media.samplePicture(picked.uri, 24, 31));
    return out;
  }, ENTRY);

  check('stored uri is idb:<id>', /^idb:p[0-9a-z]+$/.test(r.picked.uri), r.picked.uri);
  check('stored size is the picture size', r.picked.width === 240 && r.picked.height === 300);
  check('IndexedDB holds a JPEG blob', r.stored.isBlob && r.stored.type === 'image/jpeg' && r.stored.size > 1000, JSON.stringify(r.stored));
  check('grid is 24 x 30 (auto rows)', r.pic.W === 24 && r.pic.H === 30 && r.pic.autoH === 30 && r.pic.cells === 720);
  check('five yarn colors', r.pic.palette.length === 5, r.pic.palette.map((c) => `${c.name} ${c.hex} x${c.count}`).join(', '));
  check('counts add up', r.pic.palette.reduce((s, c) => s + c.count, 0) === 720);
  const bg = r.pic.palette[0];
  check('background is the largest color and is cream', bg.count > 360 && Math.abs(bg.rgb[0] - 244) + Math.abs(bg.rgb[1] - 236) + Math.abs(bg.rgb[2] - 216) < 20, bg.hex);
  check('corners are background', [0, 23, 696, 719].every((i) => r.pic.grid[i] === 0));
  const petal = r.pic.palette[r.pic.grid[4 * 24 + 12]].rgb;
  check('top petal is red', petal[0] > 180 && petal[1] < 110, JSON.stringify(petal.map(Math.round)));
  const stem = r.pic.palette[r.pic.grid[26 * 24 + 12]].rgb;
  check('stem is green', stem[1] > stem[0] && stem[1] > stem[2], JSON.stringify(stem.map(Math.round)));
  check('changing k and tidy does not read the picture again', r.readsSameSize === 0 && r.k3 === 3, `reads: ${r.readsSameSize}`);
  check('changing rows reads once', r.readsNewRows === 1 && r.rows12.H === 12 && r.rows12.autoH === 30 && r.rows12.cells === 288);
  check('samples match the reference algorithm exactly', r.sampleLength === 2160 && r.maxDiffFromReference === 0, `max diff ${r.maxDiffFromReference}`);
  check('thumbnail is a stable object URL of the stored picture', r.thumb === 'blob:' && r.thumbStable && r.thumbSize[0] === 240 && r.thumbSize[1] === 300);
  check('large pictures are shrunk to 1024', r.big.width === 1024 && r.big.height === 512, JSON.stringify(r.big));
  check('transparency is painted white', r.clearIsWhite);
  check('data URL import', r.legacy.uri === 'idb:' && r.legacy.width === 32 && r.legacy.height === 20);
  check('non-image file -> not-image', r.notImage === 'not-image', r.notImage);
  check('undecodable image -> unreadable', r.broken === 'unreadable', r.broken);
  check('non-image data URL -> not-image', r.badDataUrl === 'not-image', r.badDataUrl);
  check('missing picture -> unreadable', r.missing === 'unreadable', r.missing);
  check('messages', r.messages[0] === 'That file isn’t a picture. Try a JPG or PNG.' && r.messages[1] === 'That picture couldn’t be read. Try a JPG or PNG.');
  check('deleted picture can no longer be read', r.afterDelete === 'unreadable', r.afterDelete);

  // The file dialog: choose a file, then cancel.
  const pick = (action) =>
    Promise.all([
      page.waitForEvent('filechooser').then(action),
      page.evaluate(async (entry) => {
        const media = await import(entry);
        document.body.insertAdjacentHTML('beforeend', '<button id="go">go</button>');
        const result = new Promise((res) => {
          document.getElementById('go').onclick = () => media.pickPicture('library').then(res, (e) => res({ error: e.code }));
        });
        document.getElementById('go').click();
        const picked = await result;
        document.getElementById('go').remove();
        return { picked, inputsLeft: document.querySelectorAll('input[type=file]').length };
      }, ENTRY),
    ]).then(([, result]) => result);

  const chosen = await pick((chooser) => chooser.setFiles(join(ROOT, 'assets/samples/flower.png')));
  check('pickPicture returns the chosen picture', chosen.picked && /^idb:/.test(chosen.picked.uri) && chosen.picked.width === 240 && chosen.picked.height === 300, JSON.stringify(chosen.picked));
  check('pickPicture removes its input', chosen.inputsLeft === 0);
  const wrong = await pick((chooser) => chooser.setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }));
  check('pickPicture rejects a text file with not-image', wrong.picked?.error === 'not-image', JSON.stringify(wrong.picked));
  const cancelled = await pick((chooser) => chooser.element().evaluate((input) => input.dispatchEvent(new Event('cancel'))));
  check('pickPicture resolves null on cancel', cancelled.picked === null && cancelled.inputsLeft === 0, JSON.stringify(cancelled));

  // Pictures survive a reload (IndexedDB), and a second context without IndexedDB still works.
  await page.reload();
  const again = await page.evaluate(async ({ entry, uri }) => {
    const media = await import(entry);
    const pic = await media.buildPicture({ imageUri: uri, imageW: 240, imageH: 300, warps: 24, rows: 0, k: 5, tidy: true });
    return { H: pic.H, grid: Array.from(pic.grid) };
  }, { entry: ENTRY, uri: chosen.picked.uri });
  check('stored picture survives a reload', again.H === 30 && again.grid.length === 720);

  const bare = await context.newPage();
  await bare.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
  await bare.goto(`${ORIGIN}/`);
  const fallback = await bare.evaluate(async (entry) => {
    const media = await import(entry);
    const picked = await media.importPictureFile(await (await fetch('/assets/samples/flower.png')).blob());
    const pic = await media.buildPicture({ imageUri: picked.uri, imageW: picked.width, imageH: picked.height, warps: 24, rows: 0, k: 5, tidy: true });
    return { uri: picked.uri, H: pic.H, colors: pic.palette.length, noIdb: typeof indexedDB === 'undefined' };
  }, ENTRY);
  check('works in memory without IndexedDB', fallback.noIdb && /^idb:/.test(fallback.uri) && fallback.H === 30 && fallback.colors === 5, JSON.stringify(fallback));
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
