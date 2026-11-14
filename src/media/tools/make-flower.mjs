// Draws assets/samples/flower.png: a simple flower in a few flat colours on a
// plain cream background, 240 x 300. Run once: node src/media/tools/make-flower.mjs
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encode } from 'fast-png';

const W = 240;
const H = 300;
const SS = 3; // supersampling, for smooth edges

const CREAM = [244, 236, 216];
const PETAL = [214, 64, 82];
const CENTRE = [242, 190, 48];
const STEM = [58, 128, 70];
const LEAF = [86, 160, 84];

const ellipse = (cx, cy, rx, ry, deg) => {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = (dx * cos + dy * sin) / rx;
    const v = (-dx * sin + dy * cos) / ry;
    return u * u + v * v <= 1;
  };
};
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const FLOWER = { x: 120, y: 105 };
// Painted in order; later shapes cover earlier ones.
const shapes = [
  [STEM, rect(114, 150, 126, 290)],
  [LEAF, ellipse(84, 222, 36, 15, 28)],
  [LEAF, ellipse(158, 196, 36, 15, -28)],
];
for (let i = 0; i < 6; i++) {
  const deg = i * 60 - 90;
  const a = (deg * Math.PI) / 180;
  shapes.push([PETAL, ellipse(FLOWER.x + Math.cos(a) * 48, FLOWER.y + Math.sin(a) * 48, 40, 25, deg)]);
}
shapes.push([CENTRE, ellipse(FLOWER.x, FLOWER.y, 26, 26, 0)]);

const colorAt = (x, y) => {
  let c = CREAM;
  for (const [color, inside] of shapes) if (inside(x, y)) c = color;
  return c;
};

const data = new Uint8Array(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = colorAt(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        r += c[0];
        g += c[1];
        b += c[2];
      }
    }
    const o = (y * W + x) * 3;
    data[o] = Math.round(r / (SS * SS));
    data[o + 1] = Math.round(g / (SS * SS));
    data[o + 2] = Math.round(b / (SS * SS));
  }
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../assets/samples/flower.png');
writeFileSync(out, encode({ width: W, height: H, data, channels: 3, depth: 8 }));
console.log(`wrote ${out}`);
