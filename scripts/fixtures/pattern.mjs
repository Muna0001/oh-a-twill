// Golden fixtures for the pattern engine, dumped from the reference web app itself.
// Usage: node scripts/fixtures/pattern.mjs
//
// Opens reference/web/index.html in Chromium and drives its own globals, so the numbers
// come from the reference code and not from a second copy of it. Writes one file per
// pattern to fixtures/pattern/<id>.json plus fixtures/pattern/index.json.
//
// File format (kept compact; see src/engine/pattern/fixtures.ts for the reader):
//   { id, tile: ['##..', …], warp: [0,1,…] | null, weft: … | null, period, repWidth,
//     rowNames: { plain: [name per tile row], mirror: [name per tile row] },
//     combos: [{ start, mirror, side, warps,
//                math: { full, rem, near: [ascending], pct, longO, longU, warn },
//                rows: [index into `table` for rows 1…24] }],
//     table: [[states '#.', runs 'o2:1-2 u2:3-4' (travel order), ltr 0|1, weftKey, edgeWarp | null, repeatRow], …] }
// Rows repeat, so each distinct row of a combination is stored once in `table`.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'fixtures', 'pattern');
const WARPS = [4, 7, 24, 33, 120];
const ROWS = 24;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(join(root, 'reference', 'web', 'index.html')).href);

  /* global S, PATTERNS, rowStates, runs, goesRight, weftKey, period, repWidth, tileRowName, renderRow, renderMath */
  const fixtures = await page.evaluate(
    ({ WARPS, ROWS }) => {
      const num = (text, re, what) => {
        const m = re.exec(text);
        if (!m) throw new Error(`Could not read ${what} from: ${text}`);
        return +m[1];
      };
      const readMath = () => {
        renderMath();
        const dd = [...document.querySelectorAll('#mathBody dd')].map((d) => d.textContent);
        const fit = dd[1];
        const clean = fit.includes('nothing left over');
        const near = /you’d want (\d+)(?: or (\d+))? warps/.exec(fit);
        const side = dd[3];
        return {
          full: num(fit, /= (\d+) full repeat/, 'full repeats'),
          rem: clean ? 0 : num(fit, /with (\d+) warps? left over/, 'remainder'),
          near: near ? near.slice(1).filter(Boolean).map(Number) : [],
          pct: side.includes('Balanced') ? 50 : num(side, /about (\d+)%/, 'weft %'),
          longO: num(dd[4], /up to (\d+) warps? on top/, 'longest over'),
          longU: num(dd[4], /and (\d+) underneath/, 'longest under'),
          warn: dd[4].includes('Floats of 4 or more'),
        };
      };
      const readRow = (r) => {
        S.row = r;
        renderRow();
        const card = document.getElementById('rowCard');
        const tip = card.querySelector('.tip');
        const sub = card.querySelector('.sub').textContent;
        const rep = /Row (\d+) of the (\d+)-row repeat/.exec(sub);
        const ltr = goesRight(r);
        return [
          rowStates(r).map((o) => (o ? '#' : '.')).join(''),
          runs(rowStates(r), ltr).map((x) => `${x.over ? 'o' : 'u'}${x.n}:${x.from}-${x.to}`).join(' '),
          ltr ? 1 : 0,
          weftKey(r),
          tip ? num(tip.textContent, /warp (\d+) won/, 'edge warp') : null,
          rep ? +rep[1] : 1,
        ];
      };

      S.mode = 'pat';
      return PATTERNS.map((p) => {
        S.pat = p.id;
        S.start = 0;
        const names = (mirror) => {
          S.mirror = mirror;
          return p.tile.map((_, k) => tileRowName(k));
        };
        const out = {
          id: p.id,
          tile: p.tile.map((row) => row.map((o) => (o ? '#' : '.')).join('')),
          warp: p.warp || null,
          weft: p.weft || null,
          period: period(),
          repWidth: repWidth(),
          rowNames: { plain: names(false), mirror: names(true) },
          combos: [],
          table: [],
        };
        const seen = new Map();
        const intern = (row) => {
          const key = JSON.stringify(row);
          if (!seen.has(key)) {
            seen.set(key, out.table.length);
            out.table.push(row);
          }
          return seen.get(key);
        };
        for (let start = 0; start < p.tile.length; start++)
          for (const mirror of [false, true])
            for (const side of ['left', 'right'])
              for (const warps of WARPS) {
                Object.assign(S, { start, mirror, side, warps });
                const rows = [];
                for (let r = 1; r <= ROWS; r++) rows.push(intern(readRow(r)));
                out.combos.push({ start, mirror, side, warps, math: readMath(), rows });
              }
        return out;
      });
    },
    { WARPS, ROWS },
  );
  if (errors.length) throw new Error(`The reference page reported errors:\n${errors.join('\n')}`);

  await mkdir(outDir, { recursive: true });
  let combos = 0;
  let bytes = 0;
  for (const f of fixtures) {
    const json = JSON.stringify(f) + '\n';
    await writeFile(join(outDir, `${f.id}.json`), json);
    combos += f.combos.length;
    bytes += json.length;
  }
  const index = { warps: WARPS, rows: ROWS, patterns: fixtures.map((f) => f.id) };
  await writeFile(join(outDir, 'index.json'), JSON.stringify(index) + '\n');
  console.log(`${fixtures.length} patterns, ${combos} combinations, ${combos * ROWS} rows, ${(bytes / 1e6).toFixed(2)} MB → fixtures/pattern/`);
} finally {
  await browser.close();
}
