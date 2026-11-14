import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PaletteColor } from '../types';
import { hex, kmeans, nameColor, quantize, tidyGrid } from './index';
import { hashPixels, makePixels, PATTERNS, type PatternName } from './testPixels';

/** Fixtures come from the reference web app: `node scripts/fixtures/picture.mjs`. */
const FIXTURES = join(__dirname, '../../../fixtures/picture');
const load = <T>(name: string): T => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;

interface Output {
  grid: string;
  palette: PaletteColor[];
}
interface Case {
  pattern: PatternName;
  k: number;
  pxHash: number;
  kmeans: { C: number[]; L: string };
  plain: Output;
  tidy: Output;
}
interface QuantizeFile {
  W: number;
  H: number;
  cases: Case[];
}

const digits = (a: Uint8Array): string => Array.from(a).join('');

describe.each(['4x4', '24x31', '120x160'])('reference fixtures at %s', (size) => {
  const file = load<QuantizeFile>(`quantize-${size}.json`);
  const { W, H } = file;

  test('covers every pattern at k = 2, 4, 8', () => {
    expect(file.cases.map((c) => `${c.pattern}/${c.k}`)).toEqual(PATTERNS.flatMap((p) => [2, 4, 8].map((k) => `${p}/${k}`)));
  });

  describe.each(file.cases.map((c) => [`${c.pattern}, k = ${c.k}`, c] as const))('%s', (_label, c) => {
    const px = makePixels(c.pattern, W, H);

    test('the test generator made the same pixels as the fixture script', () => {
      expect(hashPixels(px)).toBe(c.pxHash);
    });

    test('kmeans matches bit for bit', () => {
      const { C, L } = kmeans(px, W * H, c.k);
      expect(digits(L)).toBe(c.kmeans.L);
      // Float32 values survive JSON exactly, so compare with Object.is semantics.
      expect(Array.from(C)).toStrictEqual(c.kmeans.C);
    });

    test('tidyGrid turns the raw labels into the tidied labels', () => {
      const plain = quantize(px, W, H, c.k, false);
      const g = Uint8Array.from(plain.grid);
      tidyGrid(g, W, H);
      // Tidying can change counts, so the palette order (and indices) may differ; compare by colour.
      const tidied = quantize(px, W, H, c.k, true);
      expect(Array.from(g, (v) => plain.palette[v].hex).join()).toBe(Array.from(tidied.grid, (v) => tidied.palette[v].hex).join());
    });

    test.each([
      ['tidy off', false, c.plain],
      ['tidy on', true, c.tidy],
    ] as const)('quantize, %s: grid and palette match bit for bit', (_name, tidy, want) => {
      const got = quantize(px, W, H, c.k, tidy);
      expect(got.W).toBe(W);
      expect(got.H).toBe(H);
      expect(got.grid).toBeInstanceOf(Uint8Array);
      expect(digits(got.grid)).toBe(want.grid);
      expect(got.palette).toStrictEqual(want.palette);
    });
  });
});

describe('quantize', () => {
  const px = makePixels('flower', 24, 31);

  test('clamps k to 2..8', () => {
    expect(quantize(px, 24, 31, 1, true)).toStrictEqual(quantize(px, 24, 31, 2, true));
    expect(quantize(px, 24, 31, 0, false)).toStrictEqual(quantize(px, 24, 31, 2, false));
    expect(quantize(px, 24, 31, 20, true)).toStrictEqual(quantize(px, 24, 31, 8, true));
  });

  test('palette is sorted by count, counts add up, and every index is used', () => {
    for (const pattern of PATTERNS) {
      const pic = quantize(makePixels(pattern, 24, 31), 24, 31, 8, true);
      const counts = pic.palette.map((p) => p.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(24 * 31);
      const seen = new Array<number>(pic.palette.length).fill(0);
      pic.grid.forEach((v) => seen[v]++);
      expect(seen).toEqual(counts);
    }
  });

  test('drops empty clusters: a flat field has one colour', () => {
    const pic = quantize(makePixels('flat', 24, 31), 24, 31, 8, true);
    expect(pic.palette).toHaveLength(1);
    expect(pic.palette[0]).toEqual({ rgb: [200.5, 120.25, 40], hex: '#c97828', name: 'Orange', count: 744 });
    expect(pic.grid.every((v) => v === 0)).toBe(true);
  });

  test('duplicate names get " 2", " 3" suffixes in palette order', () => {
    const names = quantize(makePixels('flower', 120, 160), 120, 160, 8, false).palette.map((p) => p.name);
    expect(names).toEqual(['Pink', 'Pink 2', 'Light orange', 'Light orange 2', 'Light yellow', 'Yellow', 'Yellow 2', 'Green']);
  });

  test('does not change the input pixels and is repeatable', () => {
    const copy = Float32Array.from(px);
    const a = quantize(px, 24, 31, 4, true);
    const b = quantize(px, 24, 31, 4, true);
    expect(px).toStrictEqual(copy);
    expect(a).toStrictEqual(b);
  });

  test('rejects a pixel buffer that is too short', () => {
    expect(() => quantize(new Float32Array(10), 4, 4, 2, true)).toThrow(RangeError);
  });

  test('120 x 400 at k = 8 finishes in under 1.5 s', () => {
    const W = 120;
    const H = 400;
    const big = makePixels('noise', W, H);
    const t0 = performance.now();
    const pic = quantize(big, W, H, 8, true);
    const ms = performance.now() - t0;
    expect(pic.grid).toHaveLength(W * H);
    expect(ms).toBeLessThan(1500);
  });
});

describe('tidyGrid', () => {
  test('fills single-cell specks between matching neighbours, in place', () => {
    // prettier-ignore
    const g = Uint8Array.from([
      0, 1, 0, 0,
      0, 0, 0, 2,
      1, 1, 0, 0,
      1, 1, 0, 2,
    ]);
    tidyGrid(g, 4, 4);
    // prettier-ignore
    expect(Array.from(g)).toEqual([
      0, 0, 0, 0,
      0, 0, 0, 0,
      1, 1, 0, 0,
      1, 1, 0, 2,
    ]);
  });

  test('leaves edges without two neighbours alone', () => {
    const g = Uint8Array.from([1, 0, 0, 1]);
    tidyGrid(g, 4, 1);
    expect(Array.from(g)).toEqual([1, 0, 0, 1]);
    const col = Uint8Array.from([1, 0, 1]);
    tidyGrid(col, 1, 3);
    expect(Array.from(col)).toEqual([1, 1, 1]);
  });
});

describe('nameColor and hex', () => {
  const table = load<{ colors: [number, number, number, string, string][] }>('namecolor.json');

  test('match the reference for every colour in the sweep', () => {
    expect(table.colors.length).toBeGreaterThan(10000);
    const wrong: string[] = [];
    for (const [r, g, b, name, code] of table.colors) {
      const got = nameColor([r, g, b]);
      if (got !== name || hex([r, g, b]) !== code) wrong.push(`${r},${g},${b}: ${got} ${hex([r, g, b])}, want ${name} ${code}`);
    }
    expect(wrong).toEqual([]);
  });

  test('the sweep reaches every base name', () => {
    const names = new Set(table.colors.map((c) => c[3]));
    for (const n of ['Black', 'White', 'Dark gray', 'Gray', 'Light gray', 'Brown', 'Dark brown']) expect(names).toContain(n);
    for (const n of ['red', 'orange', 'yellow', 'yellow-green', 'green', 'teal', 'blue', 'purple', 'pink']) {
      const cap = n[0].toUpperCase() + n.slice(1);
      expect(names).toContain(cap);
      expect(names).toContain(`Dark ${n}`);
      expect(names).toContain(`Light ${n}`);
    }
  });

  test('a few colours by hand', () => {
    expect(nameColor([0, 0, 0])).toBe('Black');
    expect(nameColor([255, 255, 255])).toBe('White');
    expect(nameColor([128, 128, 128])).toBe('Gray');
    expect(nameColor([46, 76, 143])).toBe('Blue');
    expect(nameColor([255, 0, 0])).toBe('Red');
    expect(nameColor([90, 60, 40])).toBe('Dark brown');
    expect(hex([46, 76, 143])).toBe('#2e4c8f');
    expect(hex([0.4, 254.5, 15.5])).toBe('#00ff10');
  });
});
