// Draws the app icon set (a 2/2 twill motif in Ink on Canvas, with one Marigold torn-paper square
// behind it; docs/design.md, "App identity") with a browser canvas and
// writes the PNGs over the files in assets/images/, at the sizes those files already use.
// Usage: node e2e/tools/make-icons.mjs [outDir]   (default assets/images)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, playwright } from '../lib.mjs';

const out = process.argv[2] || join(ROOT, 'assets/images');
const INK = '#030302';
const PAPER = '#FFF3E7';
const MARIGOLD = '#FDE99B';

/**
 * Each file: its size, a background (null = transparent), the motif's box as a share of the
 * shorter side, the cell colour, whether the motif sits on a rounded paper tile, and the
 * torn-paper square behind the motif (null = none; the monochrome layer is a single colour).
 * Android adaptive icons keep their artwork inside the central 66% safe zone.
 */
const FILES = [
  { name: 'icon.png', w: 1024, h: 1024, bg: PAPER, box: 0.56, ink: INK, paper: MARIGOLD },
  { name: 'favicon.png', w: 48, h: 48, bg: null, tile: PAPER, box: 0.6, ink: INK, paper: MARIGOLD },
  { name: 'splash-icon.png', w: 228, h: 213, bg: null, box: 0.64, ink: INK, paper: MARIGOLD },
  { name: 'android-icon-foreground.png', w: 512, h: 512, bg: null, box: 0.38, ink: INK, paper: MARIGOLD },
  { name: 'android-icon-background.png', w: 512, h: 512, bg: PAPER, box: 0, ink: INK, paper: null },
  { name: 'android-icon-monochrome.png', w: 432, h: 432, bg: null, box: 0.42, ink: '#000000', paper: null },
];

/** 2/2 twill in the app's fixed row order (PLAN.md section 6, item 1), row 1 at the bottom. */
const TWILL = ['##..', '#..#', '..##', '.##.'];

function draw({ w, h, bg, tile, box, ink, paper }) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  const side = Math.min(w, h);
  if (tile) {
    const r = side * 0.22;
    g.fillStyle = tile;
    g.beginPath();
    g.roundRect(0, 0, w, h, r);
    g.fill();
  }
  if (!box) return canvas.toDataURL('image/png');

  // The torn-paper square: a little bigger than the motif, offset down-right and turned a few
  // degrees, with a jagged edge from a fixed seed so the icons are the same on every run.
  if (paper) {
    let seed = 1013904223;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const s = side * box * 1.22;
    const cx = w / 2 + side * box * 0.08;
    const cy = h / 2 + side * box * 0.08;
    const tear = Math.max(0.6, s * 0.025);
    const pts = [];
    const steps = Math.max(4, Math.round(s / Math.max(3, s * 0.05)));
    const corners = [
      [-1, -1, 1, -1, 0, -1],
      [1, -1, 1, 1, 1, 0],
      [1, 1, -1, 1, 0, 1],
      [-1, 1, -1, -1, -1, 0],
    ];
    for (const [x0, y0, x1, y1, nx, ny] of corners) {
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const j = (rand() - 0.4) * tear;
        pts.push([((x0 + (x1 - x0) * t) * s) / 2 + nx * j, ((y0 + (y1 - y0) * t) * s) / 2 + ny * j]);
      }
    }
    g.save();
    g.translate(cx, cy);
    g.rotate((-6 * Math.PI) / 180);
    g.fillStyle = paper;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.restore();
  }

  const n = 6; // 6 × 6 cells: one and a half repeats, so the diagonal reads clearly.
  const size = side * box;
  const cell = size / n;
  const gap = Math.max(1, cell * 0.12);
  const x0 = (w - size) / 2;
  const y0 = (h - size) / 2;
  g.fillStyle = ink;
  for (let row = 0; row < n; row++) {
    const pattern = TWILL[row % 4];
    // Each float (a run of weft over the warps) is one rounded bar.
    for (let col = 0; col < n; ) {
      if (pattern[col % 4] !== '#') {
        col++;
        continue;
      }
      let end = col;
      while (end + 1 < n && pattern[(end + 1) % 4] === '#') end++;
      const x = x0 + col * cell + gap / 2;
      const y = y0 + (n - 1 - row) * cell + gap / 2;
      g.beginPath();
      g.roundRect(x, y, (end - col + 1) * cell - gap, cell - gap, (cell - gap) * 0.16);
      g.fill();
      col = end + 1;
    }
  }
  return canvas.toDataURL('image/png');
}

mkdirSync(out, { recursive: true });
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const file of FILES) {
  const url = await page.evaluate(`(${draw.toString().replace('TWILL[', `${JSON.stringify(TWILL)}[`)})(${JSON.stringify(file)})`);
  writeFileSync(join(out, file.name), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${file.name} ${file.w}×${file.h}`);
}
await browser.close();
