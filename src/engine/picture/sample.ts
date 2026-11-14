/**
 * Shrinks an RGBA image by averaging factor x factor blocks, the way the
 * reference averages its 4x oversampled canvas. Each pixel is first flattened
 * onto white (the reference paints the canvas white before drawing), so
 * transparent areas come out white rather than black.
 *
 * Returns (srcW / factor) * (srcH / factor) pixels as r, g, b triples.
 * Extra columns or rows that do not fill a whole block are ignored.
 */
export function boxAverage(rgba: Uint8Array | Uint8ClampedArray, srcW: number, srcH: number, factor: number): Float32Array {
  const f = Math.max(1, Math.floor(factor));
  const W = Math.floor(srcW / f);
  const H = Math.floor(srcH / f);
  if (rgba.length < srcW * srcH * 4) {
    throw new RangeError(`boxAverage: expected ${srcW * srcH * 4} bytes, got ${rgba.length}`);
  }
  const px = new Float32Array(W * H * 3);
  // Work in integers scaled by 255 (one division at the end), so fully opaque
  // input gives exactly sum / (f * f), as the reference does.
  const q = f * f * 255;
  const white = 255 * 255;
  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const i = ((yy * f + dy) * srcW + xx * f + dx) * 4;
          const a = rgba[i + 3];
          r += white + (rgba[i] - 255) * a;
          g += white + (rgba[i + 1] - 255) * a;
          b += white + (rgba[i + 2] - 255) * a;
        }
      }
      const o = (yy * W + xx) * 3;
      px[o] = r / q;
      px[o + 1] = g / q;
      px[o + 2] = b / q;
    }
  }
  return px;
}

/** Rows that keep the picture's shape at this warp count. Never fewer than 4. */
export function autoRows(warps: number, imgW: number, imgH: number): number {
  return Math.max(4, Math.round((warps * imgH) / imgW));
}
