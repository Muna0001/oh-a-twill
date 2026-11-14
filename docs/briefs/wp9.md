# WP9 — Pattern guide screen

Read `docs/briefs/common.md` first. PLAN.md: sections 1, 3 (especially 3.4 and 3.7), 4, 5, 6 and the WP9 brief. Behavioural reference: `renderRow`, `renderDraw`, `renderMath`, `renderBar` and the event handlers in `reference/web/index.html` (same order, same wording). Port 8109, scratch folder `wp9`.

**Edit only:** `src/features/guide/**` and `src/platform/**` except `legacyImport.ts`, `legacyImport.web.ts`, `legacyImport.test.ts`. Export: `PatternGuide({ projectId })`. Another agent's `ProjectScreen` renders it for pattern projects and handles "not found", but `PatternGuide` must still show an `EmptyState` if the project is missing, is not a pattern project, or has an unknown stitch id.

## src/platform

Export from `src/platform/index.ts`, with `.web.ts` / native files so Metro picks the right one; make sure tsc and Jest resolve too (see how `src/media` did it with a `.d.ts`):

- `tapHaptic()`: light impact through `expo-haptics` on native, no-op on web, never throws.
- `useKeepAwake(enabled)`: `expo-keep-awake` on native; Wake Lock API on web where available, re-acquired on `visibilitychange`, released on unmount; never throws.
- `useRowKeys(onPrev, onNext, enabled?)`: web listens for ArrowLeft / ArrowRight, ignored when the target is an input, textarea or contenteditable or a modifier is held; native no-op. Keep the hook thin over a pure, tested key-filter function.
- Re-export `readLegacy` from `./legacyImport`.

Read the installed `expo-haptics` and `expo-keep-awake` types for the SDK 58 API.

## PatternGuide (PLAN 3.4)

A scrolling `Screen` with the `BottomBar` as the non-scrolling footer.

- `Header`: project name as title, stitch name as subtitle, back (fallback `/projects`), and a right accessory opening `/project/<id>/setup`: a compact "N warps" button and/or a gear icon button.
- **Row card** (hero `Panel`): "Row N" with `DirectionPill`; the sub line "Row k of the P-row repeat. " (only when P > 1) followed by `WeftTag` ("Weft: Color A/B" with the yarn swatch); `RepeatChips` when `repeatLabels` is non-null; `StripScroller` with `WarpStrip` + `WarpNumbers`; `StepChips` in travel order; `EdgeTip` when `rowInfo.edgeWarp` is not null; "Back to row 1" when row > 1 (confirm first when the current row is above 10).
- **Drawdown** panel: heading "Drawdown", the reference hint, the `Drawdown` component; tapping a row jumps to it.
- **The math**: a `Panel` holding a `Collapsible` (closed by default) with `MathPanel` (pass `stitch.warp?.length` as `colorWarpLength`).
- `BottomBar`: left "Back" with chevron-left (disabled on row 1, label "Previous row"), centre "Row N", right primary "Row done" with chevron-right.
- Behaviour: Row done → `nextRow`, plus `tapHaptic()` if `Settings.haptics`; `useKeepAwake(Settings.keepAwake)` while mounted; `useRowKeys` for ← / →; call `open(projectId)` once on mount; the row card is a live region; after Row done scroll the row card back into view.

## Tests

Row done advances the stored row and Back goes back; Back is disabled on row 1; twill22 at 24 warps, side left: row 2 shows "Right to left" and its first step chip is "Over 1" / "warp 24"; the edge tip appears for a case you find with the engine (search `rowInfo` over the catalog for a non-null `edgeWarp`) and not for twill22 at 24 warps rows 1–8; the repeat line reads "Row 2 of the 4-row repeat."; jumping from the drawdown sets the row; "Back to row 1" above row 10 asks first; a missing project renders the fallback; the haptic is called only when the setting is on; the key filter ignores keys typed in an input.

## Done

Tests green, eslint clean, screenshots look right: twill22 at 24 warps on phone and desktop widths; herring at 120 warps scrolls horizontally inside the strip and drawdown without the page overflowing. If the other agent's `ProjectScreen` is not rendering `PatternGuide` yet, wait a few minutes and retry; if it still is not, say so and rely on Jest.
