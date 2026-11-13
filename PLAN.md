# Oh a Twill — iOS weaving app: build plan

Status: **plan only, nothing built.** This document is written to be handed to subagents. Each work package (WP) in section 8 is a self-contained brief; sections 1–7 are the shared context every agent needs.

Working title is "Oh a Twill" (from the repo name). See open decisions in section 11.

---

## 1. What we are building

An iPhone app that helps someone weave on a small frame loom with a needle. It does three things:

1. **Stitch library** (new, the headline feature). Browse weave stitches as cards with a woven preview. Each stitch has a detail page: what it looks like front and back, the row-by-row over/under sequence, the math (repeat width, rows per repeat, floats), tips, and a "Start weaving" button.
2. **Row-by-row guide** (ported from the web app). For the chosen stitch and warp count, shows one row at a time: travel direction, over/under steps in the order you weave them, an edge-catch warning, a drawdown, and Back / Row done.
3. **Weave from a picture** (ported from the web app). Pick a photo; the app reduces it to a warps × rows grid with a small yarn palette and gives per-row colour sections woven as 2/2 twill tapestry or plain weave.

Plus **saved projects**: several weavings can be in progress, each remembering its stitch or picture, settings and current row.

### Who it is for

The owner weaves on a **24-warp frame loom**, mostly **2/2 twill**. Defaults must make that case one tap away: first launch offers "2/2 twill, 24 warps" ready to weave.

### Reference implementation

`reference/web/index.html` is the existing single-file web app, and `reference/web/HANDOFF.md` is its handoff note. Together they are the **behavioural spec** for everything ported (pattern engine, picture engine, copy, colours). `HANDOFF.md`'s stack rules (single file, no dependencies, GitHub Pages) apply to the web app only and do **not** apply here.

The reference file was transcribed from the owner's paste and checked to load and run without errors. If the owner has the original file, replace it before WP1/WP2 generate fixtures.

### Out of scope for v1

Custom pattern editor, yarn amount estimates, printable pattern sheets, non-grid techniques (soumak, rya knots, loops, twining, tapestry joins), iPad layout, Android, accounts, sync, analytics. Section 10 lists them as later phases. Nothing in v1 should make them harder: keep the engine pure and the catalog data-driven.

---

## 2. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Stack | **Expo (React Native) + TypeScript**, Expo Router | Chosen by the owner. The web engines are pure JS and port nearly line for line. Agents on Linux can type-check, unit test and render the UI in a browser. No Mac needed to get it on a phone. |
| Scope | **Web parity + stitch library + saved projects** | Chosen by the owner. |
| Expo Go compatible | Only libraries bundled in Expo Go; **no custom native modules** in v1 | Lets the owner run it by scanning a QR code, with no Apple Developer account and no build. |
| Grid rendering | `react-native-svg` with run-merged rects, behind one `GridView` component | Works in Expo Go and on web (so agents can screenshot it). Skia is the fallback if device profiling shows dropped frames at 120 × 400; swapping must only touch `GridView`. |
| State | `zustand` + `persist` on `@react-native-async-storage/async-storage`; pictures as files via `expo-file-system` | Small data, simple, versioned migration. |
| Image pipeline | `expo-image-picker` → `expo-image-manipulator` (resize to `W*4 × H*4`, PNG, base64) → pure-JS PNG decode → engine | Engine stays pure and testable; no native pixel-access module needed. |
| Privacy | Fully offline. Pictures never leave the device. No analytics, no network calls at runtime (font is bundled). | The web UI promises this; keep the promise. |
| Icons | **Heroicons outline 24**, path data inlined in a local `Icon` component drawn with `react-native-svg` | Owner's standing preference for all app designs. Do not add another icon set or an icon package. |
| Font | **Familjen Grotesk** 400/500/600/700, bundled (via `@expo-google-fonts/familjen-grotesk` if it exists, otherwise the OFL TTFs in `assets/fonts/`). System font as fallback. | Matches the web app. |
| Platform | iPhone, portrait, light and dark. `supportsTablet: false`. | Keep v1 small. |

Pin the Expo SDK to the latest stable release at scaffold time and record it in `CLAUDE.md`. Install Expo-managed packages with `npx expo install` so versions match the SDK.

---

## 3. Product design

### 3.1 Navigation

```
Tabs
├── Stitches            app/(tabs)/index.tsx        library grid, search, category filter, favourites
├── Projects            app/(tabs)/projects.tsx     in-progress and finished weavings, "New from picture"
└── Settings            app/(tabs)/settings.tsx     default warps, default start edge, haptics, keep awake, theme, about

Stack (pushed over tabs)
├── stitch/[id]         stitch detail
├── project/new         setup sheet: warps, start row, colours, mirror, start edge  (modal)
├── project/[id]        the weaving guide (pattern or picture, by project kind)
└── project/[id]/setup  edit the same settings later (modal)
```

Launch behaviour: if there is a project touched in the last session, the Stitches tab shows a **Continue** card at the top ("2/2 twill · row 37 · 24 warps"). First launch shows a **Quick start** card: "2/2 twill on 24 warps" → creates the project and opens the guide.

### 3.2 Stitch library

- Two-column grid of cards: woven preview (12 × 10 cells), name, one-line description, difficulty dot.
- Filter chips by category: All, Basics, Twills, Pointed twills, Colour and weave, Favourites. Search by name and alias.
- Previews use the project default colours (Color A weft, Color B warp).

### 3.3 Stitch detail

Top to bottom:

1. Large preview (about 24 × 18 cells) with a **Front / Back** toggle. Back = every cell inverted (`over` → `under`) with the same colour rules.
2. Name, aliases, description, difficulty, "good for" line.
3. **The repeat**: every row of one repeat written out ("1. Over 2, under 2", …), each with a mini strip. For tiles wider than 6 warps show the mini strip only.
4. For colour-and-weave stitches: "Wind the warp in this order, then repeat: 4 Color A, 4 Color B."
5. **The math** for the default warp count, with a warp stepper to try other counts: repeat width, fit and nearest clean warp counts, rows per repeat, which side shows more, longest float (warn at 4+).
6. Tips (2–4 short lines from the catalog).
7. Sticky **Start weaving** button → `project/new` prefilled with this stitch.
8. Favourite toggle in the header.

### 3.4 Weaving guide — pattern project

Carried over from the web app, same order, same copy:

1. Header: project name, gear (setup), stitch name.
2. **Row card**: "Row N", direction pill (Left to right → / ← Right to left), "Row k of the P-row repeat", weft colour tag, repeat chips (when 1 < P ≤ 12), the warp strip with warp numbers, the step chips in travel order ("Over 2 · warps 21–20"), the edge-check tip, "Back to row 1".
3. **Drawdown**: 16-row window around the current row, row 1 at the bottom, current row outlined in `mark`, done rows dimmed, tap a row to jump.
4. **The math** (collapsed).
5. Fixed bottom bar: **Back** / "Row N" / **Row done**.

New on iOS: light haptic on Row done, optional keep-screen-awake while the guide is open (default on), Dynamic Type respected, VoiceOver reads the steps as one sentence in travel order.

The **warp stepper** lives at the top of the setup sheet (it was first on the web page on purpose) and is also shown as a compact "24 warps" control in the guide header that opens the same sheet.

### 3.5 Weaving guide — picture project

1. Empty state: "Add a picture" card with the hint "Bold shapes on a plain background work best, like a single flower. Your picture stays on this device." Buttons: Photo library, Camera.
2. After picking: thumbnail, "24 warps by 31 rows, 4 yarn colors", palette list with square counts, settings (Weave: 2/2 twill / Plain weave; Colors 2–8; Rows 4–400 with "Match the picture’s shape"; "Remove single-square specks").
3. **Row card**: "Row N of H", "k sections", colour strip, section chips ("Dark blue · warps 3–9, start under 2").
4. **Woven preview**: whole grid, current row outlined, rows not yet woven lightened, tap to jump, auto-scrolls to keep the current row in view.
5. Same bottom bar. After the last row: "Finished. All H rows are woven. Nice work."

### 3.6 Projects

List rows: thumbnail (stitch preview or picture), name, "Row 37 · 24 warps", last-woven date. Swipe to delete (confirm), rename, duplicate. Finished picture projects get a check. Empty state points to the Stitches tab and "New from picture".

### 3.7 Copy and tone

Reuse the web app's strings verbatim wherever a screen is ported. Sentence case, plain language, typographic quotes (’). All user-facing strings live in `src/copy.ts` so they can be reviewed in one place.

---

## 4. Architecture

### 4.1 Repo layout and ownership

Each path has exactly one owning WP. Agents must not edit files outside their paths; if a change is needed elsewhere, report it to the orchestrator.

```
app/                          Expo Router routes (thin: compose feature screens)      WP0 creates shells; WP8–WP11 fill their own routes
src/engine/                   pure TypeScript, NO react / react-native / expo imports
  types.ts                    shared contracts (section 5)                             WP0 (frozen afterwards)
  pattern/                    tile maths, rows, runs, stats                            WP1
  picture/                    box average, k-means, tidy, palette, rows                WP2
src/catalog/                  stitch data + lookup                                     WP5
src/store/                    zustand stores, persistence, migrations                  WP4
src/ui/                       theme, fonts, Icon, primitives                           WP3
src/weave/                    GridView, TilePreview, WarpStrip, StepChips, Drawdown…   WP6
src/media/                    pick, resize, decode, store pictures                     WP7
src/features/library/         stitch library + detail screens                          WP8
src/features/guide/           pattern guide screen                                     WP9
src/features/picture/         picture guide screen                                     WP10
src/features/projects/        projects list, setup sheet, settings                     WP11
src/copy.ts                   all strings                                              WP3 creates; later WPs append their own section
scripts/fixtures/             fixture generators run against reference/web             WP1, WP2
fixtures/                     generated golden JSON (committed)                        WP1, WP2
reference/web/                read-only reference                                      nobody edits
e2e/                          Playwright checks against the web export                 WP12
```

### 4.2 Layering rule

`engine` ← `catalog` ← `store` ← `weave` / `media` ← `features` ← `app`. Nothing imports upward. `src/engine` must run under plain Node with no React Native present; ESLint `no-restricted-imports` enforces it.

### 4.3 Tooling and the definition of done

- TypeScript `strict`, ESLint (expo config), Prettier.
- Jest with `jest-expo`; React Native Testing Library for components.
- `npm run check` = `tsc --noEmit && eslint . && jest`. **Every WP is done only when this is green** and its own acceptance list is met.
- `npm run web:export` = `npx expo export --platform web`; WP12 serves `dist/` and drives it with Playwright at 390 × 844 in light and dark. Chromium and Playwright are preinstalled in the cloud containers; do not reinstall them.
- GitHub Actions workflow running `npm run check` on push.

Agents cannot run the iOS simulator on Linux. Verification is: unit tests, component tests, and screenshots of the web export. Anything that can only be checked on a phone goes on the owner's device checklist (section 9).

---

## 5. Shared contracts

WP0 commits these in `src/engine/types.ts` before any parallel work starts. They are the seams between agents; changing them needs the orchestrator.

```ts
/** [row][warp]. true = weft goes OVER the warp (weft shows on the front). Row 1 is index 0. */
export type Tile = boolean[][];
export type ColorKey = 0 | 1;              // 0 = Color A (default weft), 1 = Color B (default warp)
export type Side = 'left' | 'right';

export interface Structure {
  tile: Tile;
  warp?: ColorKey[];                        // colour order across the warps; absent = all Color B
  weft?: ColorKey[];                        // colour order up the rows;     absent = all Color A
}

export interface PatternSetup {
  start: number;                            // which tile row is row 1
  mirror: boolean;                          // reverse every tile row
  side: Side;                               // edge where row 1 starts; rows alternate direction
}

export interface Run { over: boolean; n: number; from: number; to: number }   // 1-based warps, in travel order

export interface RowInfo {
  row: number;                              // 1-based
  states: boolean[];                        // per warp, left to right
  ltr: boolean;
  runs: Run[];                              // in travel order
  weftKey: ColorKey;
  repeatRow: number;                        // 1..period
  edgeWarp: number | null;                  // warp to wrap first, or null when the edge catches
}

export interface PatternStats {
  tileWidth: number; repWidth: number; period: number;
  fullRepeats: number; remainder: number; nearestCleanWarps: number[];   // ascending, max 2
  weftPct: number;                          // rounded % of cells where weft is on top, over one period
  longestOver: number; longestUnder: number;
}

export interface Stitch extends Structure {
  id: string; name: string; aliases: string[];
  category: 'basics' | 'twills' | 'pointed' | 'color';
  difficulty: 1 | 2 | 3;
  desc: string; goodFor: string; tips: string[];
}

export interface PaletteColor { rgb: [number, number, number]; hex: string; name: string; count: number }
export interface PictureGrid { W: number; H: number; grid: Uint8Array; palette: PaletteColor[] }  // grid[y*W+x], y=0 is the TOP row
export type PicWeave = 'twill22' | 'plain';
export interface Section { color: number; n: number; from: number; to: number; startOver: boolean; startN: number }
export interface PicRowInfo { row: number; cells: number[]; over: boolean[]; sections: Section[]; sameAsPrevious: boolean }
```

Engine function signatures (all pure, state passed in, no globals):

```ts
// src/engine/pattern
fromStrings(rows: string[]): Tile                         // '#' = over
threaded(threading: number[], treadling: number[]): Tile  // over when mod(t - u, 4) < 2
overAt(s: Structure, setup: PatternSetup, w: number, r: number): boolean
warpKey(s: Structure, w: number): ColorKey
weftKey(s: Structure, setup: PatternSetup, r: number): ColorKey
cellKey(s, setup, w, r): ColorKey                         // colour showing on the front
period(s: Structure): number                              // lcm(tile rows, weft length)
repWidth(s: Structure): number                            // lcm(tile width, warp length)
rowInfo(s, setup, warps: number, r: number): RowInfo
tileRowName(s, setup, k: number): string                  // "Over 2, under 2" or "Row k" when wider than 6
stats(s, setup, warps: number): PatternStats
back(s: Structure): Structure                             // inverted tile, for the Back view

// src/engine/picture
boxAverage(rgba: Uint8Array, srcW: number, srcH: number, factor: number): Float32Array  // flattens alpha onto white
autoRows(warps: number, imgW: number, imgH: number): number                             // max(4, round(W*h/w))
quantize(px: Float32Array, W: number, H: number, k: number, tidy: boolean): PictureGrid
nameColor(rgb: [number, number, number]): string
picOver(weave: PicWeave, x: number, r: number): boolean
picRowInfo(pic: PictureGrid, weave: PicWeave, r: number): PicRowInfo
```

Store shapes (`src/store`):

```ts
interface ProjectBase { id: string; name: string; warps: number; createdAt: number; updatedAt: number; row: number }
interface PatternProject extends ProjectBase { kind: 'pattern'; stitchId: string; setup: PatternSetup; colors: [string, string] }
interface PictureProject extends ProjectBase { kind: 'picture'; imageUri: string | null; imageW: number; imageH: number;
                                               rows: number /* 0 = auto */; k: number; tidy: boolean; weave: PicWeave }
type Project = PatternProject | PictureProject;

interface Settings { defaultWarps: number; defaultSide: Side; defaultColors: [string, string];
                     haptics: boolean; keepAwake: boolean; theme: 'system' | 'light' | 'dark'; favourites: string[] }
```

Limits: warps 4–120, picture colours 2–8, picture rows 4–400. Defaults: 24 warps, `twill22`, start 0, not mirrored, left edge, colours `#2E4C8F` / `#E4DCC8`, k 4, tidy on, weave `twill22`.

---

## 6. Behaviour that must be preserved from the web app

Port these exactly. Each is easy to "fix" by accident.

1. **2/2 twill row order is fixed**: `##..`, `#..#`, `..##`, `.##.` (Over 2 under 2 → Over 1 under 2 over 1 → Under 2 over 2 → Under 1 over 2 under 1). It matches how the owner weaves. Never reorder it.
2. `threaded()` twills slant the **opposite** way to `twill22` (`threaded([0,1,2,3],[0,1,2,3])` gives `##..`, `.##.`, `..##`, `#..#`). That is how chevron, arrows, herringbone and diamond are defined. Leave it.
3. Cell lookup: `tile[mod(start + r - 1, T)][mod(w, tileWidth)]`, with each tile row reversed when `mirror` is on. `arrowL` is the `arrowR` tile with rows reversed.
4. `weftKey` uses `mod(start + r - 1, weft.length)`, so the weft colour phase moves with `start`. Thumbnails ignore `start` (they always begin at tile row 0).
5. Direction: `goesRight(r) = (side === 'left') === (r % 2 === 1)`. Runs are listed in travel order; `from`/`to` are 1-based warp numbers, so a right-to-left run reads "warps 23–22".
6. Edge check: for `r > 1`, the entry edge is warp 1 when going right, warp W when going left. If that warp's state equals its state in row `r - 1`, show the tip and name that warp.
7. Warp numbers under the strip: all when W ≤ 32; otherwise 1, every 5th, and W.
8. Repeat chips only when `1 < period ≤ 12`.
9. Stats: `weftPct` is computed over rows 1..period at the current warp count and setup. `nearestCleanWarps` searches `d = 1..repWidth` for `W - d` (> 0) and `W + d` divisible by `repWidth`, stopping after 2 hits. Float warning at 4 or more.
10. Choosing a different stitch resets `start` to 0 and `row` to 1. Changing `start` resets `row` to 1. Mirror, side and colours do not reset the row.
11. k-means: the PRNG (seed `1234567`, the `Math.imul` mixer), k-means++ seeding, 16 iterations, `Float32Array` centroids and `Float64Array` sums must be reproduced operation for operation so results match the reference **bit for bit** on the same input pixels.
12. Tidy: two passes, each horizontal then vertical, in place, same loop order.
13. Palette: drop empty clusters, sort by count descending, remap grid indices, name with `nameColor`, suffix duplicates with " 2", " 3".
14. Picture rows: row `r` reads grid row `y = H - r` (row 1 is the bottom). Sections run left to right regardless of row. `picOver` for twill is `TWILL[mod(r-1,4)][mod(x,4)]`; for plain it is `mod(x + r - 1, 2) === 0`. A section's "start" is the first run of over/under inside that section.
15. "Same colors as the last row." shows when the row equals the previous row (the web variable is misleadingly called `changed`; port the behaviour, name it `sameAsPrevious`).
16. Picture `row === H + 1` means finished. Shrinking H clamps `row` to `H + 1`.

Known, accepted difference: on iOS the resize to `W*4 × H*4` is done by the OS, not a browser canvas, so the same photo may quantize slightly differently than on the web. Parity is required at the engine boundary (same pixels in → same grid out), not at the photo boundary.

---

## 7. Stitch catalog for v1

All stitches are tile-based, so every one works in the row-by-row guide.

**Carried over (11), definitions exactly as in `reference/web/index.html`:** `plain`, `basket`, `twill22`, `twill21`, `chevron`, `arrowL`, `arrowR`, `herring`, `diamond`, `hounds`, `logcabin`.

**Proposed additions (owner to confirm the list; WP5 must validate each before it ships):**

| id | Name | Definition | Category |
|---|---|---|---|
| `halfbasket` | Half basket | `##..`, `..##` | basics |
| `twill13` | 1/3 twill | `#...`, `...#`, `..#.`, `.#..` | twills |
| `twill31` | 3/1 twill | `###.`, `##.#`, `#.##`, `.###` | twills |
| `broken` | Broken twill | `##..`, `#..#`, `.##.`, `..##` | twills |
| `hairline` | Hairline stripes | plain tile, warp `AB`, weft `AB` | color |
| `wefstripes` | Weft stripes | plain tile, weft `AABB` | color |

Validation every stitch must pass (as a Jest test over the whole catalog):

- Rectangular tile, at least 2 × 2.
- No tile row is all over or all under; no tile column is all over or all under (every thread interlaces).
- `longestOver` and `longestUnder` at 24 warps ≤ 4, or the stitch carries an explicit float tip.
- Unique id; non-empty name, description, goodFor, 2–4 tips.
- A snapshot of the 24 × 16 drawdown as a `#`/`.` text block is committed, and a PNG contact sheet of all previews is produced for the owner to eyeball.

Catalog copy is weaving advice a real person will follow at the loom. Write only what the tile maths supports (structure, floats, which face shows) or what is standard, uncontroversial practice; do not invent claims about durability, drape or history. Flag anything uncertain for the owner instead of guessing.

---

## 8. Work packages

### How to run them

```
Wave 0   WP0                              serial, must merge first
Wave 1   WP1  WP2  WP3  WP4               parallel
Wave 2   WP5  WP6  WP7                    parallel   (WP5←WP1, WP6←WP1+WP3, WP7←WP2)
Wave 3   WP8  WP9  WP10  WP11             parallel   (need Wave 2 + WP4)
Wave 4   WP12 then WP13                   serial
```

Rules for every agent:

- Read `PLAN.md` sections 1–7 and your WP. Read `reference/web/index.html` for any behaviour you port.
- Work in your own worktree/branch off the integration branch; touch only your owned paths (section 4.1).
- Do not change `src/engine/types.ts`. If a contract is wrong, stop and report.
- Finish with `npm run check` green, and report: what was built, test counts, anything skipped, anything that needs a device.
- No new dependencies beyond those named in your WP without asking. Nothing that breaks Expo Go.
- Never skip or weaken a test to get green.

---

### WP0 — Scaffold and contracts

**Goal:** an Expo app that boots, with the layout, tooling and contracts everyone else builds on.

- `npx create-expo-app` (TypeScript, Expo Router) at the repo root, keeping `PLAN.md` and `reference/`.
- `app.json`: name, slug, `ios.bundleIdentifier` (placeholder from section 11), portrait, `userInterfaceStyle: "automatic"`, `supportsTablet: false`, photo-library and camera usage strings ("Pick a picture to turn into a weaving pattern. It stays on your device.").
- Folder skeleton from 4.1 with an `index.ts` per folder; tab and stack route shells that render a placeholder title.
- `src/engine/types.ts` exactly as section 5.
- ESLint (with the `src/engine` import restriction), Prettier, Jest (`jest-expo`), RNTL, `npm run check`, `npm run web:export`, GitHub Actions workflow.
- Root `CLAUDE.md`: pinned SDK version, commands, the layering rule, the ownership table, "Heroicons outline only", "offline only", pointer to `PLAN.md`.

**Accept:** `npm run check` green; `npm run web:export` succeeds; the three tabs render in a browser.

---

### WP1 — Pattern engine

**Owns:** `src/engine/pattern/`, `scripts/fixtures/pattern.mjs`, `fixtures/pattern/`. **Depends on:** WP0.

- Implement every pattern function in section 5 as pure functions, following section 6 items 1–10.
- Fixture generator: load `reference/web/index.html` in Playwright, and for every reference pattern × `start` ∈ all tile rows × `mirror` ∈ {false,true} × `side` ∈ {left,right} × warps ∈ {4, 7, 24, 33, 120}, dump for rows 1–24: `rowStates`, the run list in travel order, `weftKey`, the edge-tip warp, plus `period`, `repWidth` and the numbers behind the math panel. Commit the JSON.
- Tests: the TypeScript engine reproduces every fixture exactly. Add property tests: runs cover every warp once; `rowInfo(r)` equals `rowInfo(r + period)` apart from row number and direction; `back(back(s))` equals `s`.

**Accept:** fixtures match 100%; no React/Expo imports; branch coverage of `src/engine/pattern` ≥ 95%.

---

### WP2 — Picture engine

**Owns:** `src/engine/picture/`, `scripts/fixtures/picture.mjs`, `fixtures/picture/`. **Depends on:** WP0.

- Implement the picture functions in section 5, following section 6 items 11–16.
- `boxAverage` composites each RGBA pixel onto white before averaging (the web app paints white first).
- Fixture generator: in Playwright against the reference page, call the reference `kmeans`, `tidyGrid` and `nameColor` directly on synthetic pixel buffers (flat fields, two-colour split, a drawn flower shape, noise from a seeded generator) at sizes 4×4, 24×31, 120×160 and k ∈ {2,4,8}, tidy on/off. Dump labels, palette and names.
- Tests: bit-for-bit grid and palette match; `nameColor` table test over a hue/lightness sweep; `picRowInfo` section and "start over/under N" cases; row 1 is the bottom row; finished state.
- Performance test: `quantize` at 120 × 400, k = 8 completes in under 1.5 s under Node (guards against accidental quadratic code).

**Accept:** fixtures match 100%; pure; performance budget met.

---

### WP3 — Design system and primitives

**Owns:** `src/ui/`, `src/copy.ts`, `assets/fonts/`. **Depends on:** WP0.

- `theme.ts`: tokens from the web CSS, light and dark, exactly:

  | token | light | dark |
  |---|---|---|
  | bg | `#EEF1EC` | `#11151D` |
  | surface | `#FFFFFF` | `#1A202B` |
  | ink | `#1C2333` | `#E6E9EF` |
  | muted | `#5A6375` | `#9AA3B5` |
  | line | `#D5DAD1` | `#2C3342` |
  | weft / weftInk | `#2E4C8F` / `#FFFFFF` | `#7C98DC` / `#0F1420` |
  | warp / warpShade | `#D8D1C0` / `#C2B9A4` | `#4B505D` / `#5E6474` |
  | mark | `#D9A521` | `#E8BE55` |
  | overChip / underChip | `#E2E8F5` / `#EDEAE2` | `#22314F` / `#2C2F38` |
  | warn / warnBg | `#7A5100` / `#FBF0D3` | `#F0C66A` / `#352B15` |
  | btn / btnInk | `#1C2333` / `#FFFFFF` | `#E6E9EF` / `#11151D` |

  `useTheme()` resolves system / forced light / forced dark from Settings. Yarn colours are content and are never themed.
- Spacing, radii (panel 14, button 10, chip 999), type scale (title 28/700, row number 44/700 tabular, body 16, hint 14), minimum touch target 44 pt.
- Font loading with splash hold; system fallback if loading fails.
- `Icon` component with inlined Heroicons outline 24 paths (stroke 1.8). Start with the icons the web app uses (minus, plus, squares-2x2, photo, arrow-up-tray, arrow-long-right, arrow-long-left, exclamation-triangle, arrow-path, check-circle, chevron-left/right/down) plus heart, magnifying-glass, cog-6-tooth, trash, camera, ellipsis-horizontal.
- Primitives: `Screen`, `Panel`, `Text` variants, `Button` (default / primary / link), `Segmented`, `Stepper` (tap, hold-to-repeat, and type a number), `Chip`, `Checkbox`, `Tip`, `Swatch`, `ColorField` (a sheet with about 24 yarn-ish presets plus a hex field; no native colour picker dependency), `BottomBar` (safe-area aware), `Collapsible`.
- Every primitive has an accessibility role and label, and scales with Dynamic Type.
- A dev-only `/gallery` route showing all primitives in both themes.

**Accept:** RNTL tests for Stepper clamping/typing, Segmented selection, Button disabled; gallery renders on web in light and dark with contrast ≥ 4.5:1 for text tokens.

---

### WP4 — Store and persistence

**Owns:** `src/store/`. **Depends on:** WP0.

- `useProjects`: create (pattern / picture), update, rename, duplicate, delete, `setRow`, `nextRow`, `prevRow`, `lastOpenedId`. Enforce limits from section 5 and the reset rules in section 6 item 10 inside the actions, so screens cannot get them wrong.
- `useSettings` with the defaults in section 5.
- Persist with a `version` and a `migrate` function from day one. Storage failures are caught; the app must keep working in memory.
- Deleting a picture project deletes its image file (through an injected `deleteFile` so the store stays testable).
- Default project names: stitch name, or "Picture 1", "Picture 2".

**Accept:** unit tests with a mocked AsyncStorage for every action, the clamps, the resets, rehydration, a migration from a fake v0, and storage throwing.

---

### WP5 — Stitch catalog

**Owns:** `src/catalog/`. **Depends on:** WP1.

- `stitches.ts`: the 11 carried-over stitches (names and descriptions verbatim from the reference) plus the confirmed additions from section 7, each with aliases, category, difficulty, goodFor and tips.
- `getStitch(id)`, `listStitches({ category, query, favourites })`, with `twill22` first in the default order.
- The catalog validation test and drawdown snapshots from section 7.
- `scripts/contact-sheet.mjs`: renders every stitch preview (front and back) into one PNG in `docs/` for owner review.

**Accept:** validation test green for every stitch; contact sheet committed; the 11 reference tiles are byte-identical to the reference dump.

---

### WP6 — Weave components

**Owns:** `src/weave/`. **Depends on:** WP1, WP3.

- `GridView`: props `{ cols, rows, colorAt(x, y), cell?, highlightRow?, dimAbove?, dimBelowOpacity?, gap?, onPressRow? }`. Draws with `react-native-svg`, merging horizontal runs of equal colour into one rect. Memoised; must stay smooth at 120 × 400 inside a scroll view (render in row bands if needed). This is the only component that may later be swapped to Skia.
- `TilePreview` (stitch thumbnails and the detail hero, front/back), `WarpStrip` (pattern: warps with the weft passing over/under; picture: coloured weft cells over neutral warps), `WarpNumbers`, `StepChips` (over = weft colour chip, under = outlined chip), `SectionChips`, `RepeatChips`, `DirectionPill`, `EdgeTip`, `Drawdown` (16-row window, labels, current/done styling, tap to jump), `MathPanel` (takes `PatternStats`, renders the five items with the reference wording).
- Strips wider than the screen scroll horizontally with a minimum cell width of 10 pt.
- Accessibility: `StepChips` exposes one label, e.g. "Row 2, right to left: over 1, under 2, over 2…".

**Accept:** RNTL tests on rendered labels for row 1 and row 2 of `twill22` at 24 warps (row 2 starts "Over 1, warp 24"); `GridView` rect-count test proving run merging; gallery page on web showing each component for `twill22`, `hounds`, `herring` at 24 and 120 warps.

---

### WP7 — Picture import pipeline

**Owns:** `src/media/`. **Depends on:** WP2. **Adds:** `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, one pure-JS PNG decoder (`fast-png` or `upng-js`).

- `pickPicture(source: 'library' | 'camera')`: launch the picker, normalise orientation, downscale to max 1024 px on the long side, save as JPEG in the app's documents directory, return `{ uri, width, height }`.
- `samplePicture(uri, W, H)`: resize to `W*4 × H*4`, export PNG base64, decode to RGBA, return `boxAverage(...)` output. Cache the result per `(uri, W, H)` so changing k or tidy does not re-read the image.
- `buildPicture(project)`: `samplePicture` → `quantize`; returns a `PictureGrid`. Yields to the UI before the heavy step so a spinner can show.
- Errors map to the reference copy: "That picture couldn’t be read. Try a JPG or PNG."
- `deletePicture(uri)`.
- Web shim (file input + canvas) so the web export used for screenshots can load a bundled sample image.

**Accept:** unit tests with the Expo modules mocked: correct resize arguments, cache hits, error mapping; a decode test on a committed small PNG with transparency (alpha flattens to white).

---

### WP8 — Stitch library screens

**Owns:** `src/features/library/`, `app/(tabs)/index.tsx`, `app/stitch/[id].tsx`. **Depends on:** WP4, WP5, WP6.

Build sections 3.2 and 3.3, including the Continue / Quick start card, search, category chips, favourites, Front/Back toggle, the written-out repeat, the math with a try-a-warp-count stepper, and Start weaving → `project/new?stitch=<id>`.

**Accept:** RNTL: filtering and search; favourite persists; the detail page for `hounds` shows the warp winding order; Start weaving navigates with the stitch id. Web screenshots of the grid and of two detail pages, light and dark.

---

### WP9 — Pattern guide screen

**Owns:** `src/features/guide/`. **Depends on:** WP4, WP6. (Route file `app/project/[id].tsx` is owned by WP11, which dispatches by project kind.)

Build section 3.4 as `PatternGuide({ projectId })`. Haptic on Row done (`expo-haptics`) and keep-awake (`expo-keep-awake`), both behind Settings. Jump-to-row from the drawdown. "Back to row 1" asks for confirmation when the current row is above 10.

**Accept:** RNTL: Row done advances and persists; Back is disabled on row 1; row 2 reads right to left when row 1 starts on the left; the edge tip appears for a case taken from the WP1 fixtures and not otherwise; changing the start row in setup resets to row 1. Web screenshots for `twill22` at 24 warps and `herring` at 120 warps.

---

### WP10 — Picture guide screen

**Owns:** `src/features/picture/`. **Depends on:** WP4, WP6, WP7.

Build section 3.5 as `PictureGuide({ projectId })`: empty state, picking, palette and settings, row card, woven preview with tap-to-jump and auto-scroll, finished state. Changing warps, rows, k or tidy rebuilds the grid (debounced); changing weave does not. Show progress while rebuilding and keep the previous grid visible until the new one is ready.

**Accept:** RNTL with a mocked `buildPicture`: settings trigger the right rebuilds; row sections render from a fixture grid; finished state at `H + 1`; error copy on a failed read. Web screenshot using the bundled sample image at 24 warps, 4 colours.

---

### WP11 — Projects, setup and settings

**Owns:** `src/features/projects/`, `app/(tabs)/projects.tsx`, `app/(tabs)/settings.tsx`, `app/project/*`. **Depends on:** WP3, WP4, WP5.

- Projects list (3.6) with rename, duplicate, delete-with-confirm, and "New from picture".
- Setup sheet used for both new and existing pattern projects: **warp stepper first**, with the fit hint ("6 repeats of 4, clean edges" / "5 repeats of 4, plus 2 extra"); Start on (buttons named by `tileRowName`, hidden when the tile has one row); Yarn colors A/B; Direction (As shown / Mirrored); Row 1 starts at the (Left edge / Right edge); primary button "Start weaving".
- `app/project/[id].tsx` renders `PatternGuide` or `PictureGuide` by kind, and a not-found state.
- Settings screen for everything in `Settings`, plus an About block with the privacy line and version.

**Accept:** RNTL: create → appears in list → open → delete; setup hint text for 24 and 26 warps on `twill22`; theme override switches tokens. Web screenshots of each screen.

---

### WP12 — Integration, accessibility and polish

**Owns:** `e2e/`, cross-cutting fixes agreed with the orchestrator. **Depends on:** all above.

- Playwright flow against the web export at 390 × 844, light and dark: first launch → Quick start → three rows done → reload → still on row 4; library → Houndstooth → Start weaving; new picture project with the sample image → rows → finished.
- Check against the web reference side by side for `twill22`/24: same step text for rows 1–8.
- Accessibility pass: labels, roles, focus order, 44 pt targets, Dynamic Type at the largest size without clipping, contrast.
- Empty, loading and error states everywhere; safe areas; keyboard avoidance on number entry.
- App icon and splash (simple twill motif in the brand colours), produced as assets, no extra dependencies.
- `README.md`: how to run, test, and get it on a phone.

**Accept:** e2e green; a screenshot set committed under `docs/screens/`; open issues listed with severity.

---

### WP13 — Device builds and release prep

**Depends on:** WP12 and the owner prerequisites in section 9.

- `eas.json` with `development`, `preview` and `production` profiles; `expo-doctor` clean.
- Document the two ways to run on the owner's iPhone: Expo Go from a local `npx expo start`, and an EAS build delivered through TestFlight.
- App Store metadata draft: description, keywords, privacy answers ("Data not collected"), screenshots from `docs/screens/`.
- Do not submit anything; produce the build and the checklist, and hand to the owner.

**Accept:** a successful EAS iOS build (if credentials are available) or a precise list of what is blocked on the owner.

---

## 9. What only the owner can do

1. **Confirm the stitch additions** in section 7 and the app name / bundle id in section 11.
2. **Expo account** (free) and an `EXPO_TOKEN` for cloud builds. Needed for WP13 only.
3. **Apple Developer Program** membership if the app should be installed through TestFlight or the App Store. Not needed to try it in Expo Go.
4. **Device checklist** after WP12 (things agents cannot verify on Linux): fonts load; haptics fire; screen stays awake in the guide; photo picker and camera work and the permission wording reads right; a real flower photo quantizes cleanly at 4 colours; the 120-warp preview scrolls smoothly; VoiceOver reads a row sensibly; dark mode at the loom is readable.

---

## 10. Later phases (not planned in detail)

- **Techniques library**: soumak, rya knots, loops, twining, hem stitch, tapestry joins. These are not grids; they need illustrated step diagrams and a second catalog entry type (`kind: 'technique'`). The `Stitch` type and library screens should gain a discriminated union at that point, not before.
- **Custom pattern editor**: draw a tile on a grid, save it as a personal stitch. The engine already accepts any `Structure`.
- **Yarn estimates** from warp width and square counts.
- **Pattern sheet export** (PDF / share sheet).
- **iPad layout**, **Android**, **iCloud backup**.
- **Hands-free**: read the row aloud; advance with a volume button or a Bluetooth pedal.

---

## 11. Open decisions (defaults are used unless the owner says otherwise)

| Question | Default |
|---|---|
| App name | "Oh a Twill" |
| Bundle identifier | `com.example.ohatwill` placeholder, replaced before WP13 |
| Stitch additions in section 7 | Include all six |
| Spelling | US in ported strings ("Color"), matching the web app |
| Keep screen awake in the guide | On by default |
| Camera as a picture source | Included |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Engine drift from the web app | Golden fixtures generated from the reference itself (WP1, WP2); section 6 list. |
| Agents cannot run iOS | Engine in pure TS; RNTL; web export + Playwright; explicit owner device checklist. |
| Large grids are slow in SVG | Run merging, banded rendering, single `GridView` seam with a Skia fallback. |
| Parallel agents collide | One owner per path; frozen contracts; route files assigned; orchestrator merges wave by wave. |
| Wrong weaving advice in catalog copy | Catalog validation, drawdown snapshots, contact sheet, owner review; copy limited to what the maths supports. |
| Photo results differ from the web | Accepted and documented; parity defined at the pixel-buffer boundary. |
| Dependency breaks Expo Go | Dependency allow-list per WP; `expo-doctor` in WP13; no custom native modules in v1. |
