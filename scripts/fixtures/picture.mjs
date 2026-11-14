// Generates fixtures/picture/*.json for the picture engine tests (WP2).
//
// Opens the reference web app in headless Chromium and calls its own
// `kmeans`, `tidyGrid`, `nameColor` and `hex` on synthetic pixel buffers, then
// repeats the palette-building steps of its `processPic`. The engine port in
// src/engine/picture must match these files bit for bit.
//
// Run from the repo root:   node scripts/fixtures/picture.mjs
//
// The pixel generator below has a line-for-line twin in
// src/engine/picture/testPixels.ts. Change both together.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Playwright is installed globally, which ESM `import` cannot see; require() can.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REFERENCE = resolve(ROOT, 'reference/web/index.html');
const OUT = resolve(ROOT, 'fixtures/picture');

/* ---------- Synthetic pixels (twin of src/engine/picture/testPixels.ts) ---------- */

const PATTERNS = ['flat', 'split', 'flower', 'noise'];

// Colours in sixteenths of a level.
const FLAT = [3208, 1924, 640];
const SPLIT_A = [736, 1216, 2288];
const SPLIT_B = [3648, 3520, 3200];
const BACKGROUND = [3760, 3600, 3280];
const PETAL = [3440, 1280, 2080];
const CENTRE = [3840, 3040, 480];
const STEM = [800, 2240, 960];
// Petal centres, in 1/32 of the shorter side, from the middle of the picture.
const PETALS = [
  [0, -10],
  [10, -3],
  [6, 8],
  [-6, 8],
  [-10, -3],
];

function makePixels(pattern, W, H) {
  let s = (Math.imul(W, 7919) ^ Math.imul(H, 104729) ^ Math.imul(PATTERNS.indexOf(pattern) + 1, 1299709)) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s >>> 20; // 0..4095
  };
  const px = new Float32Array(W * H * 3);
  const m = Math.min(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c;
      let jitter = false;
      if (pattern === 'flat') {
        c = FLAT;
      } else if (pattern === 'split') {
        c = x * 2 < W ? SPLIT_A : SPLIT_B;
      } else if (pattern === 'flower') {
        jitter = true;
        // Coordinates in 1/64 of a cell, from the middle of the picture.
        const dx = (2 * x + 1 - W) * 32;
        const dy = (2 * y + 1 - H) * 32;
        c = BACKGROUND;
        if (dy > 0 && dx >= -3 * m && dx <= 3 * m) c = STEM;
        for (const [ox, oy] of PETALS) {
          const ex = dx - ox * m * 2;
          const ey = dy - oy * m * 2;
          if (ex * ex + ey * ey <= 14 * m * 14 * m) c = PETAL;
        }
        if (dx * dx + dy * dy <= 10 * m * 10 * m) c = CENTRE;
      } else {
        c = [rnd(), rnd(), rnd()];
      }
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        let v = c[ch];
        if (jitter) v = Math.max(0, Math.min(4080, v + (rnd() >>> 6) - 32));
        px[o + ch] = v / 16;
      }
    }
  }
  return px;
}

// FNV-1a over the channels (as sixteenths), to prove both generators agree.
function hashPixels(px) {
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i++) {
    const v = px[i] * 16;
    h = Math.imul(h ^ (v & 0xff), 16777619);
    h = Math.imul(h ^ (v >>> 8), 16777619);
  }
  return h >>> 0;
}

/* ---------- Colours for the nameColor table ---------- */

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

function nameColorInputs() {
  const list = [];
  // Integer colours from a hue / saturation / lightness sweep.
  for (let h = 0; h < 360; h += 3) {
    for (const s of [0.05, 0.13, 0.15, 0.3, 0.5, 0.74, 0.76, 1]) {
      for (const l of [0.05, 0.12, 0.14, 0.25, 0.29, 0.31, 0.36, 0.41, 0.43, 0.5, 0.6, 0.69, 0.71, 0.73, 0.85, 0.91, 0.97]) {
        list.push(hslToRgb(h, s, l));
      }
    }
  }
  // Every gray, and the corners of the cube.
  for (let v = 0; v < 256; v++) list.push([v, v, v]);
  for (const r of [0, 255]) for (const g of [0, 255]) for (const b of [0, 255]) list.push([r, g, b]);
  // Fractional colours, as cluster centres are (Float32 values, like a palette entry).
  let s = 20240607;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s >>> 8; // 0..16777215
  };
  for (let i = 0; i < 2000; i++) list.push([rnd(), rnd(), rnd()].map((v) => Math.fround((v * 255) / 16777215)));
  return list;
}

/* ---------- Run the reference ---------- */

const SIZES = [
  [4, 4],
  [24, 31],
  [120, 160],
];
const KS = [2, 4, 8];

// Runs inside the reference page. `kmeans`, `tidyGrid`, `nameColor` and `hex`
// are the reference's own globals; the rest repeats `processPic` after its
// canvas step.
function runInPage({ px: values, W, H, K }) {
  /* global kmeans, tidyGrid, nameColor, hex */
  const px = new Float32Array(values);
  const n = W * H;
  const finish = (tidy) => {
    const { C, L } = kmeans(px, n, K);
    const raw = { C: Array.from(C), L: Array.from(L).join('') };
    if (tidy) tidyGrid(L, W, H);
    const cnt = new Array(K).fill(0);
    for (const v of L) cnt[v]++;
    const order = [...Array(K).keys()].filter((k) => cnt[k] > 0).sort((a, b) => cnt[b] - cnt[a]);
    const remap = new Uint8Array(K);
    order.forEach((k, j) => (remap[k] = j));
    const grid = L.map((v) => remap[v]);
    const used = {};
    const palette = order.map((k) => {
      const rgb = [C[k * 3], C[k * 3 + 1], C[k * 3 + 2]];
      let name = nameColor(rgb);
      used[name] = (used[name] || 0) + 1;
      if (used[name] > 1) name += ' ' + used[name];
      return { rgb, hex: hex(rgb), name, count: cnt[k] };
    });
    return { raw, out: { grid: Array.from(grid).join(''), palette } };
  };
  const plain = finish(false);
  const tidy = finish(true);
  return { kmeans: plain.raw, plain: plain.out, tidy: tidy.out };
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(REFERENCE).href);
  mkdirSync(OUT, { recursive: true });

  let cases = 0;
  for (const [W, H] of SIZES) {
    const file = { source: 'reference/web/index.html', W, H, cases: [] };
    for (const pattern of PATTERNS) {
      const px = makePixels(pattern, W, H);
      for (const K of KS) {
        const result = await page.evaluate(runInPage, { px: Array.from(px), W, H, K });
        file.cases.push({ pattern, k: K, pxHash: hashPixels(px), ...result });
        cases += 2;
      }
    }
    writeFileSync(resolve(OUT, `quantize-${W}x${H}.json`), JSON.stringify(file) + '\n');
  }

  const inputs = nameColorInputs();
  const names = await page.evaluate((list) => {
    return list.map((rgb) => [nameColor(rgb), hex(rgb)]);
  }, inputs);
  const table = { source: 'reference/web/index.html', colors: inputs.map((rgb, i) => [...rgb, ...names[i]]) };
  writeFileSync(resolve(OUT, 'namecolor.json'), JSON.stringify(table) + '\n');

  console.log(`Wrote ${cases} quantize cases in ${SIZES.length} files and ${inputs.length} named colours to fixtures/picture/`);
} finally {
  await browser.close();
}
