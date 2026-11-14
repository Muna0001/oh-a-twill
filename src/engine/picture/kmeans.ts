/**
 * Colour clustering for pictures. Ported operation for operation from the
 * reference web app (reference/web/index.html, "Picture engine") so the same
 * pixels give the same grid bit for bit. Do not "tidy up" the arithmetic:
 * the PRNG, the Float32Array centroids, the Float64Array sums and the loop
 * order all matter. See PLAN.md section 6, items 11 and 12.
 */

export interface KMeansResult {
  /** K * 3 centroid channels (r, g, b per cluster). */
  C: Float32Array;
  /** One cluster index per pixel. */
  L: Uint8Array;
}

/**
 * k-means with k-means++ seeding and 16 fixed iterations.
 * `px` holds n pixels as r, g, b triples.
 */
export function kmeans(px: Float32Array, n: number, K: number): KMeansResult {
  let seed = 1234567;
  const rnd = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const C = new Float32Array(K * 3);
  const D = new Float32Array(n).fill(Infinity);
  const L = new Uint8Array(n);
  const dist = (i: number, k: number): number => {
    const a = px[i * 3] - C[k * 3];
    const b = px[i * 3 + 1] - C[k * 3 + 1];
    const c = px[i * 3 + 2] - C[k * 3 + 2];
    return a * a + b * b + c * c;
  };

  const i0 = Math.floor(rnd() * n);
  C[0] = px[i0 * 3];
  C[1] = px[i0 * 3 + 1];
  C[2] = px[i0 * 3 + 2];
  for (let k = 1; k < K; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dist(i, k - 1);
      if (d < D[i]) D[i] = d;
      sum += D[i];
    }
    let t = rnd() * sum;
    let j = 0;
    for (; j < n - 1; j++) {
      t -= D[j];
      if (t <= 0) break;
    }
    C[k * 3] = px[j * 3];
    C[k * 3 + 1] = px[j * 3 + 1];
    C[k * 3 + 2] = px[j * 3 + 2];
  }

  for (let it = 0; it < 16; it++) {
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = dist(i, k);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      L[i] = best;
    }
    const sum = new Float64Array(K * 3);
    const cnt = new Uint32Array(K);
    for (let i = 0; i < n; i++) {
      const k = L[i];
      cnt[k]++;
      sum[k * 3] += px[i * 3];
      sum[k * 3 + 1] += px[i * 3 + 1];
      sum[k * 3 + 2] += px[i * 3 + 2];
    }
    for (let k = 0; k < K; k++) {
      if (cnt[k]) {
        C[k * 3] = sum[k * 3] / cnt[k];
        C[k * 3 + 1] = sum[k * 3 + 1] / cnt[k];
        C[k * 3 + 2] = sum[k * 3 + 2] / cnt[k];
      }
    }
  }
  return { C, L };
}

/**
 * Removes single-cell specks, in place: a cell that differs from two matching
 * neighbours takes their value. Two passes, each horizontal then vertical.
 */
export function tidyGrid(g: Uint8Array, W: number, H: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (g[i] !== g[i - 1] && g[i - 1] === g[i + 1]) g[i] = g[i - 1];
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < H - 1; y++) {
        const i = y * W + x;
        if (g[i] !== g[i - W] && g[i - W] === g[i + W]) g[i] = g[i - W];
      }
    }
  }
}
