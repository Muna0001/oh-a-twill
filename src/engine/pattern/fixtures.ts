/**
 * Test helper: reads the golden fixtures written by scripts/fixtures/pattern.mjs.
 * Not exported from the engine; only the tests import it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ColorKey, PatternSetup, Run, Structure } from '../types';
import { fromStrings } from './pattern';

const DIR = join(__dirname, '..', '..', '..', 'fixtures', 'pattern');

export interface FixtureMath {
  full: number;
  rem: number;
  near: number[];
  pct: number;
  longO: number;
  longU: number;
  warn: boolean;
}

/** [states, runs, ltr, weftKey, edgeWarp, repeatRow] */
type RawRow = [string, string, 0 | 1, ColorKey, number | null, number];

interface RawFixture {
  id: string;
  tile: string[];
  warp: ColorKey[] | null;
  weft: ColorKey[] | null;
  period: number;
  repWidth: number;
  rowNames: { plain: string[]; mirror: string[] };
  combos: { start: number; mirror: boolean; side: 'left' | 'right'; warps: number; math: FixtureMath; rows: number[] }[];
  table: RawRow[];
}

export interface FixtureRow {
  states: boolean[];
  runs: Run[];
  ltr: boolean;
  weftKey: ColorKey;
  edgeWarp: number | null;
  repeatRow: number;
}

export interface FixtureCombo {
  setup: PatternSetup;
  warps: number;
  math: FixtureMath;
  /** Rows 1…n, in order. */
  rows: FixtureRow[];
}

export interface Fixture {
  id: string;
  /** Built from the dumped tile and colour orders, so tests do not need the catalog. */
  structure: Structure;
  period: number;
  repWidth: number;
  rowNames: { plain: string[]; mirror: string[] };
  combos: FixtureCombo[];
}

export const fixtureIndex = (): { warps: number[]; rows: number; patterns: string[] } =>
  JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));

const parseRun = (text: string): Run => {
  const m = /^([ou])(\d+):(\d+)-(\d+)$/.exec(text);
  if (!m) throw new Error(`Bad run in fixture: ${text}`);
  return { over: m[1] === 'o', n: +m[2], from: +m[3], to: +m[4] };
};

const parseRow = (raw: RawRow): FixtureRow => ({
  states: [...raw[0]].map((c) => c === '#'),
  runs: raw[1].split(' ').map(parseRun),
  ltr: raw[2] === 1,
  weftKey: raw[3],
  edgeWarp: raw[4],
  repeatRow: raw[5],
});

export function loadFixture(id: string): Fixture {
  const raw: RawFixture = JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));
  const structure: Structure = { tile: fromStrings(raw.tile) };
  if (raw.warp) structure.warp = raw.warp;
  if (raw.weft) structure.weft = raw.weft;
  const table = raw.table.map(parseRow);
  return {
    id: raw.id,
    structure,
    period: raw.period,
    repWidth: raw.repWidth,
    rowNames: raw.rowNames,
    combos: raw.combos.map((c) => ({
      setup: { start: c.start, mirror: c.mirror, side: c.side },
      warps: c.warps,
      math: c.math,
      rows: c.rows.map((i) => table[i]),
    })),
  };
}

export const loadAllFixtures = (): Fixture[] => fixtureIndex().patterns.map(loadFixture);
