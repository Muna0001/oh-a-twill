# Weaving Helper — Claude Code handoff

> Reference only. This is the handoff note for the **web app** in `index.html`. Its rules ("keep it a single file", "no dependencies", GitHub Pages) apply to that web app, **not** to the iOS app. For the iOS app, follow `/PLAN.md`.

A mobile-first web app that guides hand weaving on a small frame loom, one row at a time. It has two modes:

1. **Patterns**: pick a weave structure (2/2 twill by default). The app gives over/under steps for every row, a drawdown, and the math.
2. **From a picture**: upload an image. The app reduces it to a grid (one square per warp per row) with a small yarn palette, then gives per-row color sections woven as twill tapestry (or plain weave).

The owner weaves on a **24-warp frame loom** with a needle, and mostly does **2/2 twill**.

## Files

```
index.html   # the entire app: HTML + CSS + JS, no build step
CLAUDE.md    # this file
```

Keep it a **single self-contained file** unless asked otherwise. It must run by opening `index.html` directly, and on GitHub Pages.

## Stack and constraints

- Vanilla HTML/CSS/JS, no framework, no bundler, no dependencies.
- The only external request is the Google Fonts stylesheet for **Familjen Grotesk**. The system font stack is the fallback.
- **Icons: Heroicons outline 24 (https://heroicons.dev/), inlined as SVG.** This is the owner's standing preference for all app designs. Don't introduce another icon set.
- State persists in `localStorage` under the key `weaving-helper-v3`. Every access is wrapped in try/catch, and the app must work without storage. On first load it migrates `warps` and `row` from the old key `twill-helper-v2`.
- Images are processed entirely in the browser and never uploaded. Keep it that way; the UI promises it.

## State (`S`)

```js
{
  warps: 24,              // 4–120, shared by both modes
  mode: 'pat' | 'pic',
  pat: 'twill22',         // pattern id (default: 2/2 twill)
  start: 0,               // which tile row is row 1
  mirror: false,          // flips the tile horizontally
  side: 'left',           // edge where row 1 starts (rows alternate direction)
  colors: ['#2E4C8F', '#E4DCC8'], // Color A (default weft), Color B (default warp)
  row: 1,                 // current row in pattern mode
  pic: {
    src: null,            // downscaled JPEG data URL (max 320px)
    rows: 0,              // 0 = auto from aspect ratio
    k: 4,                 // palette size, 2–8
    tidy: true,           // remove single-square specks
    row: 1,               // current row in picture mode (H + 1 = finished)
    weave: 'twill22'      // 'twill22' | 'plain'
  }
}
```

`update()` saves state, then re-renders everything for the active mode. Picture changes that alter the grid (warps, k, rows, tidy, new image) go through `refreshPic()`, which reprocesses and then calls `update()`.

## Pattern engine

Every structure is a **tile**: an array of rows, each row an array of booleans. `true` means **the weft goes over the warp** (weft shows on the front).

- **Row 1 is the first array entry.** Drawdowns show row 1 at the bottom, like the loom.
- Cell lookup: `tile[(start + r - 1) mod T][w mod tileWidth]`, with the tile reversed per row when `mirror` is on.
- Optional `warp` / `weft` arrays of color keys (`0` = Color A, `1` = Color B) make color-and-weave patterns. With no arrays, the warp is Color B and the weft is Color A.
- `period()` = lcm(tile rows, weft color length). `repWidth()` = lcm(tile width, warp color length).
- `threaded(t, u)` builds 4-shaft 2/2 twills from a threading `t` (per warp) and a treadling `u` (per row): over when `(t - u) mod 4 < 2`.

| id | Name | Definition |
|---|---|---|
| `plain` | Plain weave | `#.` / `.#` |
| `basket` | Basket weave | `##..`, `##..`, `..##`, `..##` |
| `twill22` | 2/2 twill | `##..`, `#..#`, `..##`, `.##.` |
| `twill21` | 2/1 twill | `##.`, `#.#`, `.##` |
| `chevron` | Chevron | `threaded([0,1,2,3,2,1], [0,1,2,3])` |
| `arrowL` | Arrow left | arrow-right tile, mirrored |
| `arrowR` | Arrow right | `threaded([0,1,2,3], [0,1,2,3,4,5,4,3,2,1])` |
| `herring` | Herringbone | `threaded([0,1,2,3,0,1,2,3,1,0,3,2,1,0,3,2], [0,1,2,3])` |
| `diamond` | Diamond | `threaded([0,1,2,3,2,1], [0,1,2,3,2,1])` |
| `hounds` | Houndstooth | 2/2 twill tile, warp and weft `AAAABBBB` |
| `logcabin` | Log cabin | plain tile, warp and weft `ABABAB BABABA` |

**Don't change the 2/2 twill row order.** It matches the owner's own four rows: Over 2 under 2 → Over 1 under 2 over 1 → Under 2 over 2 → Under 1 over 2 under 1. The "Start on" buttons are named from these rows. The houndstooth color phase was checked against this tile; re-check it if the tile changes.

### Row instructions

- **Travel direction alternates.** Row 1 goes from `side`, the next row goes back. `runs(states, ltr)` run-length encodes the row in travel order, so a right-to-left row lists steps from warp 24 down.
- **Edge check:** if the edge warp where this row starts has the same over/under state as at the end of the last row, the weft won't catch it. The app shows a tip to wrap the weft around that warp first.
- The math panel shows repeat width, fit across the warps (with the nearest even-repeat warp counts), rows per repeat, front-side coverage %, and the longest floats (warns at 4 or more).

## Picture engine

1. **Upload:** draw the image onto white (flattens transparency), downscale to max 320px, store as a JPEG data URL in `S.pic.src`.
2. **Sample:** draw at `W*4 × H*4`, then average each 4×4 block into `W × H` pixels. `W` = warps. `H` = `pic.rows`, or `round(W * imgH / imgW)` when that's 0.
3. **Quantize:** k-means with k-means++ seeding and a fixed-seed PRNG (same image, same result), 16 iterations, squared RGB distance.
4. **Tidy (optional):** two passes that replace single-cell horizontal and vertical specks with their neighbors.
5. **Palette:** drop empty clusters, sort by count, name each color with an HSL heuristic (`nameColor`), and add 2, 3… to duplicate names.
6. **Rows:** row `r` (1-based, bottom-up) reads grid row `y = H - r`. Sections are runs of the same color, listed left to right.
7. **Weave per cell:** `picOver(x, r)` uses the 2/2 twill tile by default, or `(x + r - 1)` even for plain weave. Each section shows how to start, for example "start under 2".

The preview is a `<canvas>`: DPR-aware, current row outlined in `--mark`, rows not yet woven lightened. Tapping a row jumps to it.

## UI structure (top to bottom)

1. Header
2. **Warp threads stepper.** It's first on purpose; the owner asked for it there. Tap −/+ or type a number. The hint shows the repeat fit, or the picture width.
3. Tabs: Patterns / From a picture
4. Pattern mode: pattern summary (picker opens on first visit or via Change), current row card, drawdown (16-row window, tap to jump), math (collapsed)
5. Picture mode: upload drop zone, or the thumbnail with palette and settings (weave, colors, rows, cleanup); current row card; woven preview
6. Fixed bottom bar: Back / Row N / Row done. Arrow keys also work.

## Design system

- Colors are CSS custom properties on `:root`. Dark mode redefines them under `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. Every new color needs both light and dark values.
- Yarn colors (the user's Color A/B and the picture palette) are content, so they're applied inline and aren't themed.
- Mobile-first, 44rem max width, 16px gutters, safe-area insets on the root and the bottom bar, touch targets ≥ 2.6rem.
- Sentence-case labels, plain-language copy, typographic quotes (’).

## Testing

```bash
# Syntax check the inline script
python3 -c "import re;s=open('index.html').read();open('/tmp/s.js','w').write(re.search(r'<script>(.*)</script>',s,re.S).group(1))" && node --check /tmp/s.js
```

Check in a ~390px mobile viewport, in both light and dark mode:

- First load opens Patterns on 2/2 twill with 24 warps.
- Steps for row 2 read right to left when row 1 starts on the left.
- Houndstooth and Arrow left/right drawdowns look right.
- A simple flower image (bold shapes, plain background) quantizes cleanly at 4 colors.
- Reloading keeps the pattern, the row, and the picture.

## Deploy (GitHub Pages)

```bash
git init && git add index.html CLAUDE.md && git commit -m "Weaving helper"
gh repo create weaving-helper --public --source=. --push
gh api repos/{owner}/weaving-helper/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

Replace `{owner}` with the GitHub username. The site will be at `https://<username>.github.io/weaving-helper/`.

## Possible next steps (not started)

- PWA manifest and service worker so it works offline at the loom.
- Saved projects (pattern or picture plus current row) instead of one global state.
- A custom pattern editor that draws a tile on a grid.
- Yarn amount estimates from the warp width and the square counts.
- Exporting a printable pattern sheet.
- Porting to Expo / React Native if a native app is wanted. The pattern and picture engines are pure functions and port directly.
