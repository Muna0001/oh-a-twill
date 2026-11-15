# Oh a Twill

A weaving helper for small frame looms. It has three parts:

- **Stitch library**: weave stitches as cards with a woven preview. Each stitch has a page with its front and back, the row-by-row over and under, the math for your warp count, and tips.
- **Row-by-row guide**: one row at a time, in the order you weave it: which way to travel, the over and under steps with warp numbers, an edge check, and a drawdown of the cloth so far. Back and Row done (or ← and → on a keyboard) move between rows.
- **Weave from a picture**: pick a photo and the app turns it into a grid with a small yarn palette, then gives the color sections for each row, woven as 2/2 twill tapestry or plain weave.

Several weavings can be in progress at once; each remembers its stitch or picture, settings and row. Everything stays on the device: no account, no network calls, no tracking. The web build works offline once loaded.

It is one Expo (React Native) codebase, released as a web app first, then for iOS and Android.

## Where things are

- `PLAN.md`: the product and build plan (the spec). Read it before changing anything.
- `CLAUDE.md`: commands, rules and layering for anyone (or any agent) working in the repo.
- `src/`: the app. Routes in `src/app/`, screens in `src/features/`, the pure pattern and picture engines in `src/engine/`.
- `reference/web/`: the old single-file web app, kept read-only as the behavioural reference.
- `e2e/`: end-to-end checks against the web export (Playwright, plain Node scripts).
- `docs/design.md`: the visual spec (warm paper-coloured canvas, soft pastels, a serif for big headlines and a clean sans for everything else, rounded cards floated on soft shadows), generated from `design/tokens.json` and `design/variables.css`.
- `docs/screens/`: screenshots of every screen, phone size, light and dark, plus the library on a desktop.

## Run it

Needs Node 22 and npm.

```bash
npm install
npm start            # Expo dev server: press w for the web, or scan the QR code with Expo Go
npm run web          # straight to the web build in a browser
```

## Test

```bash
npm run check        # TypeScript, ESLint and Jest: must be green before a change is done
npx jest src/engine  # a subset of the unit tests
npm run e2e          # end-to-end: exports the web build, serves it, drives it with Playwright
```

`npm run e2e` exports to a temporary folder, serves it on port 8112 and runs every `e2e/*.test.mjs` file: the main flows at 390 × 844 and 1280 × 800, a side-by-side check of the guide's steps against `reference/web/index.html`, and accessibility checks (names and states, keyboard, Escape and focus in sheets, 200% zoom, reduced motion). It uses Chromium and WebKit; a browser that is not installed is skipped with a note. Useful variables:

- `E2E_DIST=dist npm run e2e` tests an export you already have instead of building one.
- `E2E_PORT=9000` serves on another port.
- `E2E_BROWSERS=chromium` picks the browsers.
- `npm run e2e -- e2e/flows.test.mjs` runs one file.

The service worker and install checks for the web release are separate: `npm run e2e:pwa`.

## Build and serve the web app

```bash
npm run web:export   # static web build (with the PWA manifest, icons and service worker) into dist/
npm run web:serve    # serve dist/ on http://localhost:8081 with a fallback to index.html for deep links
```

`npm run web:export:pages` builds for the GitHub Pages sub-path (`/oh-a-twill`). Pushes to the default branch are checked and deployed to GitHub Pages by `.github/workflows/deploy-web.yml`.

## Screenshots and icons

With a build served on port 8112 (`node scripts/serve-dist.mjs 8112 dist`):

```bash
node e2e/tools/screens.mjs docs/screens phone   # refresh docs/screens/ (light and dark, plus desktop-library-light.png)
```

The app icon, favicon, splash and Android adaptive icon layers in `assets/images/` are drawn by `node e2e/tools/make-icons.mjs` (the 2/2 twill motif in ink `#030302` on the canvas colour `#FFF3E7`).
