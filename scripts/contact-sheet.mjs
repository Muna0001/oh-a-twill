// Renders every catalog stitch, front and back, into docs/stitches.png for the owner to eyeball.
// Usage: node scripts/contact-sheet.mjs
//
// The catalog and engine are TypeScript. Node 22 strips the types by itself, but it will not
// guess the ".ts" extension of relative imports, so a small resolve hook adds it. This works
// because src/catalog and src/engine use relative imports only (no "@/" alias).
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
      const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      for (const file of [`${base}.ts`, path.join(base, 'index.ts')]) {
        if (existsSync(file)) return { url: pathToFileURL(file).href, format: 'module-typescript', shortCircuit: true };
      }
    }
    const resolved = nextResolve(specifier, context);
    return resolved.url.endsWith('.ts') ? { ...resolved, format: 'module-typescript' } : resolved;
  },
});

const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const { STITCHES, CATEGORIES } = await load('src/catalog/index.ts');
const { back, cellKey } = await load('src/engine/pattern/pattern.ts');

// Project defaults: Color A (weft), Color B (warp).
const COLORS = ['#2E4C8F', '#E4DCC8'];
const SETUP = { start: 0, mirror: false, side: 'left' };
const WARPS = 24;
const ROWS = 16;
const CELL = 8;
const COLUMNS = 3;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Row 1 at the bottom, as on the loom. */
function preview(structure) {
  let cells = '';
  for (let r = 1; r <= ROWS; r++) {
    for (let w = 0; w < WARPS; w++) {
      if (cellKey(structure, SETUP, w, r) === 0) cells += `<rect x="${w * CELL}" y="${(ROWS - r) * CELL}" width="${CELL}" height="${CELL}"/>`;
    }
  }
  const W = WARPS * CELL;
  const H = ROWS * CELL;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges"><rect width="${W}" height="${H}" fill="${COLORS[1]}"/><g fill="${COLORS[0]}">${cells}</g></svg>`;
}

const label = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const cards = STITCHES.map(
  (s, i) => `<div class="card">
  <h2>${i + 1}. ${esc(s.name)}</h2>
  <p>${esc(s.id)} · ${esc(label[s.category])} · difficulty ${s.difficulty}</p>
  <div class="pair">
    <figure>${preview(s)}<figcaption>Front</figcaption></figure>
    <figure>${preview(back(s))}<figcaption>Back</figcaption></figure>
  </div>
</div>`,
).join('\n');

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { font: 13px/1.4 system-ui, sans-serif; color: #1c1c1c; background: #fff; padding: 24px; width: max-content; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .note { color: #555; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, max-content); gap: 20px; }
  .card { border: 1px solid #d5d5d5; border-radius: 8px; padding: 12px; }
  h2 { font-size: 15px; }
  .card p { color: #555; margin-bottom: 8px; }
  .pair { display: flex; gap: 12px; }
  figure svg { display: block; border: 1px solid #999; }
  figcaption { color: #555; margin-top: 2px; }
</style>
<h1>Oh a Twill: stitch catalog</h1>
<p class="note">${STITCHES.length} stitches, ${WARPS} warps × ${ROWS} rows, row 1 at the bottom. Color A ${COLORS[0]} (weft), Color B ${COLORS[1]} (warp).</p>
<div class="grid">${cards}</div>`;

const out = path.join(root, 'docs', 'stitches.png');
mkdirSync(path.dirname(out), { recursive: true });

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.locator('body').screenshot({ path: out });
} finally {
  await browser.close();
}
console.log(`Wrote ${path.relative(root, out)} (${STITCHES.length} stitches)`);
