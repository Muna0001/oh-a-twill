# WP8 — Stitch library screens

Read `docs/briefs/common.md` first. PLAN.md: sections 1, 3 (all), 4, 5, 6 and the WP8 brief. Port 8108, scratch folder `wp8`.

**Edit only:** `src/features/library/**`. Exports: `LibraryScreen()` and `StitchDetailScreen({ id })`.

## LibraryScreen (PLAN 3.1, 3.2)

- Title "Stitches".
- Top card, one of:
  - **Continue**, when `lastOpenedId` points at an existing project: its name, "Row N · W warps", a `TilePreview` for pattern projects, a button to `/project/<id>`.
  - **Quick start**, when there are no projects: "2/2 twill on 24 warps" (Settings defaults for warps, colours, side) with a primary button that calls `createPattern({ stitchId: 'twill22', name: '2/2 twill', … })`, `open(id)` and navigates to `/project/<id>`.
  - Nothing otherwise.
- **Legacy import offer** (PLAN 3.7), web only, once: when `readLegacy()` (from `@/platform/legacyImport`) returns data and `legacyImportHandled` is false, show "Bring over your weaving from the old helper" with "Bring it over" and "Not now". Accepting creates a pattern project from the legacy pattern (name from the catalog stitch, warps, setup, colours, row) and, if a picture is present, a picture project (`importPictureDataUrl`, then `createPicture` with imageUri/imageW/imageH, rows, k, tidy, weave, row, warps). Either choice calls `setLegacyImportHandled()`. Never modify the old key.
- `SearchField`, category chips (All, Basics, Twills, Pointed twills, Color and weave, Favorites), then the grid of stitch cards: two columns on phones, more as width allows (cards about 160–200 px wide, content max width 720). Each card: `TilePreview` 12×10 in the Settings default colours, name, description (2 lines max), difficulty as 1–3 dots with an accessibility label like "Difficulty 2 of 3", a heart if favourited. A card is one button labelled "<name>. <description>" and opens `/stitch/<id>`. Empty search state.

## StitchDetailScreen (PLAN 3.3)

- `Header` with back and a favourite heart toggle (filled when on; label switches "Add to favorites" / "Remove from favorites").
- Large `TilePreview` (about 24×18) with a Front / Back `Segmented`.
- Name, aliases ("Also called …" when any), description, difficulty, goodFor.
- Colour-and-weave: "Wind the warp in this order, then repeat: …" (`warpOrderText`) and "Weave the weft in this order, then repeat: …" (`weftOrderText`).
- **The repeat** (`RepeatList`).
- **The math**: warp count starts at `Settings.defaultWarps`, a `Stepper` (4–120) to try other counts, the fit hint under it ("6 repeats of 4, clean edges" / "5 repeats of 4, plus 2 extra"), and `MathPanel` with `stats(stitch, defaultSetup, warps)`.
- **Tips** list.
- Sticky footer primary button "Start weaving" → `router.push('/project/new?stitch=' + id)`.
- Unknown id → `EmptyState` "Stitch not found" with a button back to the library.

## Tests

Category filtering and search narrow the grid; Favorites filter shows only favourited stitches and the detail toggle persists in the settings store; the `hounds` detail page shows "4 Color A, 4 Color B"; Start weaving navigates to `/project/new?stitch=hounds`; Quick start creates a twill22 project with 24 warps and navigates; Continue shows when a project was opened; unknown id shows not found; the legacy offer appears when a mocked `readLegacy` returns data and is not shown again after "Not now".

## Done

Tests green, eslint clean, screenshots of the grid and of the twill22 and hounds detail pages look right in light and dark at both sizes.
