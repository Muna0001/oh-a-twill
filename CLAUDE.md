# Oh a Twill

A weaving helper for small frame looms: stitch library, row-by-row guide, weave-from-a-picture. One Expo codebase, released web first, then iOS, then Android. **Read `PLAN.md` before changing anything**; it is the spec. `reference/web/` is the old single-file web app, read-only, and is the behavioural spec for ported logic.

## Stack

Expo SDK 58, React Native 0.88, React 19, Expo Router (routes in `src/app/`), TypeScript strict, `react-native-svg`, `zustand`, Jest (`jest-expo`) + React Native Testing Library. Import alias: `@/` = `src/`.

Expo changes every release: do not trust memory for Expo APIs. Read the installed package's types or README under `node_modules/` before using an API.

## Commands

```bash
npm run check         # tsc --noEmit && expo lint && jest   (must be green before a WP is done)
npx jest src/engine   # run a subset
npm run web:export    # static web build into dist/
node scripts/serve-dist.mjs 8099   # serve dist/ with SPA fallback, for Playwright
```

The sandbox blocks Expo's API host, so install Expo packages with `EXPO_OFFLINE=1 npx expo install <pkg>`. Chromium and Playwright are preinstalled (`require('playwright')` works anywhere); never install them.

## Rules

- **Layering:** `engine` ← `catalog` ← `store` ← `weave` / `media` / `platform` ← `features` ← `app`. Nothing imports upward. `src/engine` is pure TypeScript (no React, React Native, Expo); ESLint enforces it.
- **Contracts are frozen:** `src/engine/types.ts` and `src/store/types.ts`. Report a problem instead of editing them.
- **Routes are fixed:** files in `src/app/` are thin shells that render screens exported from `src/features/*` and `src/ui`. Build screens in the feature folders; keep the exported names.
- **Ownership:** each folder has one owning work package (PLAN.md section 4.1). Do not edit outside yours.
- **Platform code** (`.web.ts` / `.native.ts`) lives only in `src/media/` and `src/platform/`.
- **Icons:** Heroicons outline 24 only, inlined in `src/ui` and drawn with `react-native-svg`. No icon packages, no other icon sets.
- **Offline only:** no network calls at runtime, no analytics. Pictures never leave the device.
- **Dependencies:** everything must work on web, iOS, Android and in Expo Go. No custom native modules. Do not add a dependency without asking.
- **Strings:** user-facing copy lives in a `copy.ts` in the folder that uses it. Reuse the reference app's wording verbatim for ported screens. Sentence case, typographic quotes (’), US spelling ("Color").
- **2/2 twill row order is fixed:** `##..`, `#..#`, `..##`, `.##.`. Never reorder it. See PLAN.md section 6 for the full list of behaviours to preserve.
- Never skip or weaken a test to get green.
