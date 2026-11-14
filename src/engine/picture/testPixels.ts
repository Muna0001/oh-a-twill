/**
 * Synthetic pixel buffers for the fixture tests. This is a line-for-line twin
 * of the generator in scripts/fixtures/picture.mjs: change both together and
 * regenerate the fixtures. Integer arithmetic only, and every channel is a
 * multiple of 1/16 in 0..255 (what a 4x box average of 8-bit pixels gives),
 * so the buffers are identical on every JS engine. Test-only: not exported
 * from the picture engine's index.
 */

export const PATTERNS = ['flat', 'split', 'flower', 'noise'] as const;
export type PatternName = (typeof PATTERNS)[number];

type Rgb16 = readonly [number, number, number];

/** Colours in sixteenths of a level. */
const FLAT: Rgb16 = [3208, 1924, 640];
const SPLIT_A: Rgb16 = [736, 1216, 2288];
const SPLIT_B: Rgb16 = [3648, 3520, 3200];
const BACKGROUND: Rgb16 = [3760, 3600, 3280];
const PETAL: Rgb16 = [3440, 1280, 2080];
const CENTRE: Rgb16 = [3840, 3040, 480];
const STEM: Rgb16 = [800, 2240, 960];
/** Petal centres, in 1/32 of the shorter side, from the middle of the picture. */
const PETALS: readonly (readonly [number, number])[] = [
  [0, -10],
  [10, -3],
  [6, 8],
  [-6, 8],
  [-10, -3],
];

export function makePixels(pattern: PatternName, W: number, H: number): Float32Array {
  let s = (Math.imul(W, 7919) ^ Math.imul(H, 104729) ^ Math.imul(PATTERNS.indexOf(pattern) + 1, 1299709)) >>> 0;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s >>> 20; // 0..4095
  };
  const px = new Float32Array(W * H * 3);
  const m = Math.min(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c: Rgb16;
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

/** FNV-1a over the channels (as sixteenths), to prove both generators agree. */
export function hashPixels(px: Float32Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < px.length; i++) {
    const v = px[i] * 16;
    h = Math.imul(h ^ (v & 0xff), 16777619);
    h = Math.imul(h ^ (v >>> 8), 16777619);
  }
  return h >>> 0;
}
