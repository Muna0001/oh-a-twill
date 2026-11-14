import type { RowInfo } from '../types';
import { fixtureIndex, loadAllFixtures } from './fixtures';
import {
  cellKey,
  fromStrings,
  goesRight,
  overAt,
  period,
  PLAIN,
  repWidth,
  rowInfo,
  runs,
  stats,
  threaded,
  tileRowName,
  TWILL,
  warpKey,
  weftKey,
} from './index';

const index = fixtureIndex();
const fixtures = loadAllFixtures();

describe('golden fixtures from the reference web app', () => {
  it('cover every reference pattern, start row, mirror, side and warp count', () => {
    expect(index.patterns).toEqual([
      'plain', 'basket', 'twill22', 'twill21', 'chevron', 'arrowL', 'arrowR', 'herring', 'diamond', 'hounds', 'logcabin',
    ]);
    expect(index.warps).toEqual([4, 7, 24, 33, 120]);
    expect(index.rows).toBe(24);
    let combos = 0;
    for (const f of fixtures) {
      expect(f.combos).toHaveLength(f.structure.tile.length * 2 * 2 * index.warps.length);
      for (const c of f.combos) expect(c.rows).toHaveLength(index.rows);
      combos += f.combos.length;
    }
    expect(combos).toBe(1060);
  });

  describe.each(fixtures.map((f) => [f.id, f] as const))('%s', (_id, f) => {
    const s = f.structure;

    it('period and repWidth', () => {
      expect(period(s)).toBe(f.period);
      expect(repWidth(s)).toBe(f.repWidth);
    });

    it('tileRowName for every tile row, plain and mirrored', () => {
      const names = (mirror: boolean) => s.tile.map((_, k) => tileRowName(s, { start: 0, mirror, side: 'left' }, k));
      expect(names(false)).toEqual(f.rowNames.plain);
      expect(names(true)).toEqual(f.rowNames.mirror);
    });

    it('rows 1–24 of every combination', () => {
      for (const c of f.combos) {
        const where = `${f.id} ${JSON.stringify(c.setup)} warps ${c.warps}`;
        c.rows.forEach((want, i) => {
          const r = i + 1;
          const expected: RowInfo = {
            row: r,
            states: want.states,
            ltr: want.ltr,
            runs: want.runs,
            weftKey: want.weftKey,
            repeatRow: want.repeatRow,
            edgeWarp: want.edgeWarp,
          };
          // A string comparison per row keeps 25,440 rows fast (same key order as rowInfo); toEqual reports the diff.
          const got = rowInfo(s, c.setup, c.warps, r);
          if (JSON.stringify(got) !== JSON.stringify(expected)) {
            expect(got).toEqual(expected);
            throw new Error(`${where} row ${r}\n got ${JSON.stringify(got)}\nwant ${JSON.stringify(expected)}`);
          }
        });
      }
    });

    it('the single-cell functions agree with the rows', () => {
      for (const c of f.combos) {
        c.rows.forEach((want, i) => {
          const r = i + 1;
          expect(goesRight(c.setup, r)).toBe(want.ltr);
          expect(weftKey(s, c.setup, r)).toBe(want.weftKey);
          expect(runs(want.states, want.ltr)).toEqual(want.runs);
          for (let w = 0; w < c.warps; w++) {
            const over = overAt(s, c.setup, w, r);
            if (over !== want.states[w]) throw new Error(`overAt ${f.id} warp ${w} row ${r}`);
            const key = over ? want.weftKey : warpKey(s, w);
            if (cellKey(s, c.setup, w, r) !== key) throw new Error(`cellKey ${f.id} warp ${w} row ${r}`);
          }
        });
      }
    });

    it('the math panel numbers of every combination', () => {
      for (const c of f.combos) {
        const got = stats(s, c.setup, c.warps);
        expect({ where: [c.setup, c.warps], ...got }).toEqual({
          where: [c.setup, c.warps],
          tileWidth: s.tile[0].length,
          repWidth: f.repWidth,
          period: f.period,
          fullRepeats: c.math.full,
          remainder: c.math.rem,
          nearestCleanWarps: c.math.near,
          weftPct: c.math.pct,
          longestOver: c.math.longO,
          longestUnder: c.math.longU,
        });
        // The reference warns about floats of 4 or more.
        expect(Math.max(got.longestOver, got.longestUnder) >= 4).toBe(c.math.warn);
      }
    });
  });
});

describe('the reference tiles can be rebuilt with fromStrings and threaded', () => {
  const tileOfFixture = (id: string) => fixtures.find((f) => f.id === id)!.structure.tile;

  it('PLAIN and TWILL', () => {
    expect(PLAIN).toEqual(tileOfFixture('plain'));
    expect(TWILL).toEqual(tileOfFixture('twill22'));
    expect(TWILL).toEqual(fromStrings(['##..', '#..#', '..##', '.##.']));
    expect(tileOfFixture('hounds')).toEqual(TWILL);
    expect(tileOfFixture('logcabin')).toEqual(PLAIN);
  });

  it('threaded twills slant the opposite way to twill22', () => {
    expect(threaded([0, 1, 2, 3], [0, 1, 2, 3])).toEqual(fromStrings(['##..', '.##.', '..##', '#..#']));
  });

  it('chevron, arrows, herringbone and diamond', () => {
    const arrow = threaded([0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]);
    expect(threaded([0, 1, 2, 3, 2, 1], [0, 1, 2, 3])).toEqual(tileOfFixture('chevron'));
    expect(arrow).toEqual(tileOfFixture('arrowR'));
    expect(arrow.map((r) => [...r].reverse())).toEqual(tileOfFixture('arrowL'));
    expect(threaded([0, 1, 2, 3, 0, 1, 2, 3, 1, 0, 3, 2, 1, 0, 3, 2], [0, 1, 2, 3])).toEqual(tileOfFixture('herring'));
    expect(threaded([0, 1, 2, 3, 2, 1], [0, 1, 2, 3, 2, 1])).toEqual(tileOfFixture('diamond'));
  });
});
