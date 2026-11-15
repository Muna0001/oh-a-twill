// Draws the app icon set (a 2/2 twill motif in Ink on Canvas; docs/design.md, "App identity")
// with a browser canvas and
// writes the PNGs over the files in assets/images/, at the sizes those files already use.
// Usage: node e2e/tools/make-icons.mjs [outDir]   (default assets/images)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, playwright } from '../lib.mjs';

const out = process.argv[2] || join(ROOT, 'assets/images');
const INK = '#030302';
const PAPER = '#FFF3E7';

/**
 * Each file: its size, a background (null = transparent), the motif's box as a share of the
 * shorter side, the cell colour and whether the motif sits on a rounded canvas tile.
 * Android adaptive icons keep their artwork inside the central 66% safe zone.
 */
const FILES = [
  { name: 'icon.png', w: 1024, h: 1024, bg: PAPER, box: 0.62, ink: INK },
  { name: 'favicon.png', w: 48, h: 48, bg: null, tile: PAPER, box: 0.74, ink: INK },
  { name: 'splash-icon.png', w: 228, h: 213, bg: null, box: 0.9, ink: INK },
  { name: 'android-icon-foreground.png', w: 512, h: 512, bg: null, box: 0.42, ink: INK },
  { name: 'android-icon-background.png', w: 512, h: 512, bg: PAPER, box: 0, ink: INK },
  { name: 'android-icon-monochrome.png', w: 432, h: 432, bg: null, box: 0.42, ink: '#000000' },
];

/** 2/2 twill in the app's fixed row order (PLAN.md section 6, item 1), row 1 at the bottom. */
const TWILL = ['##..', '#..#', '..##', '.##.'];

function draw({ w, h, bg, tile, box, ink }) {
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
