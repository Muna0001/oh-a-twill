import type { PaletteColor, PictureGrid } from '../types';
import { hex, nameColor } from './color';
import { kmeans, tidyGrid } from './kmeans';

/**
 * Turns W * H averaged pixels into a grid of palette indices plus the palette.
 * Mirrors the second half of `processPic` in the reference: clamp k to 2..8,
 * cluster, optionally tidy, drop empty clusters, sort by count (largest
 * first), remap, then name the colours ("Green", "Green 2", ...).
 */
export function quantize(px: Float32Array, W: number, H: number, k: number, tidy: boolean): PictureGrid {
  const n = W * H;
  if (px.length < n * 3) throw new RangeError(`quantize: expected ${n * 3} channel values, got ${px.length}`);
  const K = Math.max(2, Math.min(8, k));
  const { C, L } = kmeans(px, n, K);
  if (tidy) tidyGrid(L, W, H);

  const cnt = new Array<number>(K).fill(0);
  for (let i = 0; i < n; i++) cnt[L[i]]++;
  const order: number[] = [];
  for (let c = 0; c < K; c++) if (cnt[c] > 0) order.push(c);
  order.sort((a, b) => cnt[b] - cnt[a]); // stable: ties keep cluster order
  const remap = new Uint8Array(K);
  order.forEach((c, j) => {
    remap[c] = j;
  });
  const grid = new Uint8Array(n);
  for (let i = 0; i < n; i++) grid[i] = remap[L[i]];

  const used: Record<string, number> = {};
  const palette: PaletteColor[] = order.map((c) => {
    const rgb: [number, number, number] = [C[c * 3], C[c * 3 + 1], C[c * 3 + 2]];
    let name = nameColor(rgb);
    used[name] = (used[name] || 0) + 1;
    if (used[name] > 1) name += ' ' + used[name];
    return { rgb, hex: hex(rgb), name, count: cnt[c] };
  });
  return { W, H, grid, palette };
}
