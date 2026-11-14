import type { PatternSetup, Side, Structure } from '../types';
import { loadAllFixtures } from './fixtures';
import { back, cellKey, fromStrings, overAt, period, repWidth, rle, rowInfo, runs, stats, tileOf, tileRowName, TWILL, warpKey, weftKey } from './index';

const fixtures = loadAllFixtures();
const WARPS = [4, 5, 7, 24, 33, 120];
const SIDES: Side[] = ['left', 'right'];

/** Every setup for a structure. */
const setups = (s: Structure): PatternSetup[] =>
  s.tile.flatMap((_, start) => [false, true].flatMap((mirror) => SIDES.map((side) => ({ start, mirror, side }))));

describe('twill22 at 24 warps, starting on the left', () => {
  const s: Structure = { tile: TWILL };
  const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };

  it('row 1 goes left to right and starts over 2, warps 1–2', () => {
    const info = rowInfo(s, setup, 24, 1);
    expect(info.ltr).toBe(true);
    expect(info.runs[0]).toEqual({ over: true, n: 2, from: 1, to: 2 });
    expect(info.runs).toHaveLength(12);
    expect(info.runs[11]).toEqual({ over: false, n: 2, from: 23, to: 24 });
    expect(info.edgeWarp).toBeNull();
    expect(info.repeatRow).toBe(1);
    expect(info.weftKey).toBe(0);
  });

  it('row 2 goes right to left and starts over 1 at warp 24', () => {
    const info = rowInfo(s, setup, 24, 2);
    expect(info.ltr).toBe(false);
    expect(info.runs[0]).toEqual({ over: true, n: 1, from: 24, to: 24 });
    expect(info.runs[1]).toEqual({ over: false, n: 2, from: 23, to: 22 });
    expect(info.runs[info.runs.length - 1]).toEqual({ over: true, n: 1, from: 1, to: 1 });
    expect(info.edgeWarp).toBeNull();
  });

  it('the row order is ##.., #..#, ..##, .##.', () => {
    const rows = [1, 2, 3, 4].map((r) => rowInfo(s, setup, 4, r).states.map((o) => (o ? '#' : '.')).join(''));
    expect(rows).toEqual(['##..', '#..#', '..##', '.##.']);
    expect([0, 1, 2, 3].map((k) => tileRowName(s, setup, k))).toEqual([
      'Over 2, under 2',
      'Over 1, under 2, over 1',
      'Under 2, over 2',
      'Under 1, over 2, under 1',
    ]);
  });

  it('starting on the right flips every direction', () => {
    const right: PatternSetup = { ...setup, side: 'right' };
    expect(rowInfo(s, right, 24, 1).ltr).toBe(false);
    expect(rowInfo(s, right, 24, 1).runs[0]).toEqual({ over: false, n: 2, from: 24, to: 23 });
    expect(rowInfo(s, right, 24, 2).ltr).toBe(true);
  });

  it('the math', () => {
    expect(stats(s, setup, 24)).toEqual({
      tileWidth: 4, repWidth: 4, period: 4, fullRepeats: 6, remainder: 0, nearestCleanWarps: [], weftPct: 50, longestOver: 2, longestUnder: 2,
    });
    expect(stats(s, setup, 33).nearestCleanWarps).toEqual([32, 36]);
    expect(stats(s, setup, 26).nearestCleanWarps).toEqual([24, 28]);
  });
});

describe('edge check', () => {
  it('names the entry warp when it is in the same state as in the row below', () => {
    // Basket weaves each row twice, so the second row of a pair never catches the edge.
    const basket: Structure = { tile: fromStrings(['##..', '##..', '..##', '..##']) };
    const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };
    expect(rowInfo(basket, setup, 24, 1).edgeWarp).toBeNull();
    expect(rowInfo(basket, setup, 24, 2).edgeWarp).toBe(24);
    expect(rowInfo(basket, setup, 24, 3).edgeWarp).toBeNull();
    expect(rowInfo(basket, setup, 24, 4).edgeWarp).toBe(24);
    expect(rowInfo(basket, { ...setup, side: 'right' }, 24, 2).edgeWarp).toBe(1);
  });
});

describe('colours', () => {
  const hounds = fixtures.find((f) => f.id === 'hounds')!.structure;

  it('default to Color B warp and Color A weft', () => {
    const s: Structure = { tile: TWILL };
    const setup: PatternSetup = { start: 0, mirror: false, side: 'left' };
    expect(warpKey(s, 5)).toBe(1);
    expect(weftKey(s, setup, 5)).toBe(0);
    expect(cellKey(s, setup, 0, 1)).toBe(0); // over: weft shows
    expect(cellKey(s, setup, 2, 1)).toBe(1); // under: warp shows
  });

  it('the weft colour phase moves with start', () => {
    expect([1, 2, 3, 4, 5].map((r) => weftKey(hounds, { start: 0, mirror: false, side: 'left' }, r))).toEqual([0, 0, 0, 0, 1]);
    expect([1, 2, 3, 4, 5].map((r) => weftKey(hounds, { start: 3, mirror: false, side: 'left' }, r))).toEqual([0, 1, 1, 1, 1]);
  });

  it('cellKey is the weft colour when over, the warp colour when under', () => {
    const setup: PatternSetup = { start: 1, mirror: true, side: 'right' };
    for (let r = 1; r <= 16; r++)
      for (let w = 0; w < 16; w++)
        expect(cellKey(hounds, setup, w, r)).toBe(overAt(hounds, setup, w, r) ? weftKey(hounds, setup, r) : warpKey(hounds, w));
  });

  it('colour orders stretch the repeat', () => {
    expect(period(hounds)).toBe(8);
    expect(repWidth(hounds)).toBe(8);
    expect(stats(hounds, { start: 0, mirror: false, side: 'left' }, 4).nearestCleanWarps).toEqual([8]);
  });
});

describe('tiles', () => {
  it('mirror reverses every tile row and leaves the structure alone', () => {
    const s: Structure = { tile: fromStrings(['##.', '#.#', '.##']) };
    expect(tileOf(s, { start: 0, mirror: true, side: 'left' })).toEqual(fromStrings(['.##', '#.#', '##.']));
    expect(tileOf(s, { start: 0, mirror: false, side: 'left' })).toBe(s.tile);
    expect(s.tile).toEqual(fromStrings(['##.', '#.#', '.##']));
  });

  it('tiles wider than 6 are named by row number', () => {
    const wide: Structure = { tile: fromStrings(['###....', '.###...']) };
    expect(tileRowName(wide, { start: 0, mirror: false, side: 'left' }, 1)).toBe('Row 2');
    const six: Structure = { tile: fromStrings(['##..#.']) };
    expect(tileRowName(six, { start: 0, mirror: false, side: 'left' }, 0)).toBe('Over 2, under 2, over 1, under 1');
  });

  it('rle counts runs of equal values', () => {
    expect(rle([0, 0, 0, 0, 1, 1, 1, 1])).toEqual([{ v: 0, n: 4 }, { v: 1, n: 4 }]);
    expect(rle(['a', 'b', 'b', 'a'])).toEqual([{ v: 'a', n: 1 }, { v: 'b', n: 2 }, { v: 'a', n: 1 }]);
    expect(rle([])).toEqual([]);
  });
});

describe('properties', () => {
  describe.each(fixtures.map((f) => [f.id, f.structure] as const))('%s', (_id, s) => {
    it('runs cover every warp exactly once, in travel order', () => {
      for (const setup of setups(s))
        for (const W of WARPS)
          for (let r = 1; r <= 2 * period(s) + 1; r++) {
            const info = rowInfo(s, setup, W, r);
            expect(info.states).toHaveLength(W);
            const visited: number[] = [];
            info.runs.forEach((run, i) => {
              const step = info.ltr ? 1 : -1;
              expect(run.n).toBe(Math.abs(run.to - run.from) + 1);
              if (run.n > 1) expect(Math.sign(run.to - run.from)).toBe(step);
              if (i > 0) expect(run.over).toBe(!info.runs[i - 1].over);
              for (let k = 0; k < run.n; k++) {
                const warp = run.from + k * step;
                expect(info.states[warp - 1]).toBe(run.over);
                visited.push(warp);
              }
            });
            const all = Array.from({ length: W }, (_, i) => i + 1);
            expect(visited).toEqual(info.ltr ? all : all.reverse());
          }
    });

    it('rowInfo(r) equals rowInfo(r + period) apart from the row number and direction', () => {
      const P = period(s);
      for (const setup of setups(s))
        for (const W of WARPS)
          for (let r = 1; r <= 2 * P; r++) {
            const a = rowInfo(s, setup, W, r);
            const b = rowInfo(s, setup, W, r + P);
            expect(b.row).toBe(r + P);
            expect(b.states).toEqual(a.states);
            expect(b.weftKey).toBe(a.weftKey);
            expect(b.repeatRow).toBe(a.repeatRow);
            if (P % 2 === 0) {
              // Same direction, so the steps read the same. Row 1 never has an edge tip, so skip it there.
              expect(b.ltr).toBe(a.ltr);
              expect(b.runs).toEqual(a.runs);
              if (r > 1) expect(b.edgeWarp).toBe(a.edgeWarp);
            } else {
              // An odd repeat comes back travelling the other way: same row, read from the other edge.
              expect(b.ltr).toBe(!a.ltr);
              expect(b.runs).toEqual(runs(a.states, !a.ltr));
              expect(b.runs.map((x) => [x.over, x.n])).toEqual([...a.runs].reverse().map((x) => [x.over, x.n]));
            }
          }
    });

    it('back(back(s)) equals s, and back inverts every cell', () => {
      const flipped = back(s);
      expect(back(flipped)).toEqual(s);
      expect(flipped.warp).toEqual(s.warp);
      expect(flipped.weft).toEqual(s.weft);
      expect(flipped.tile).not.toBe(s.tile);
      for (const setup of setups(s))
        for (let r = 1; r <= period(s); r++)
          for (let w = 0; w < repWidth(s); w++) {
            expect(overAt(flipped, setup, w, r)).toBe(!overAt(s, setup, w, r));
            expect(warpKey(flipped, w)).toBe(warpKey(s, w));
            expect(weftKey(flipped, setup, r)).toBe(weftKey(s, setup, r));
          }
    });

    it('front and back weft share adds up to 100%', () => {
      for (const setup of setups(s))
        for (const W of WARPS) {
          const front = stats(s, setup, W);
          const rear = stats(back(s), setup, W);
          expect(rear.longestOver).toBe(front.longestUnder);
          expect(rear.longestUnder).toBe(front.longestOver);
          expect(Math.abs(front.weftPct + rear.weftPct - 100)).toBeLessThanOrEqual(1);
        }
    });
  });
});
