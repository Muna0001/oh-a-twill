# Oh a Twill — visual design (v2, "paper scrapbook")

Source of truth for the look of the app. It adapts a scrapbook-style reference the owner chose: warm paper canvas, soft pastels, torn-paper collage accents, a literary serif for big headlines and a clean sans for everything else, soft rounded cards floated on layered shadows.

We take the **style**, not the brand: no product names, logos or copy from the reference, and its commercial fonts are replaced by free equivalents.

This is a tool used at the loom. Where the reference (a marketing site) conflicts with reading a row quickly, legibility wins: no decoration in the weaving guides, and contrast rules beat palette purity.

## Fonts

| Use | Family | Package | Weights |
|---|---|---|---|
| Headlines 24 px and up | **Lora** | `@expo-google-fonts/lora` | 400 (500 only if a heading needs it) |
| Everything else | **Inter** | `@expo-google-fonts/inter` | 400, 500, 600, 700 |

Familjen Grotesk is removed. Load all weights with `useFonts`, one family name per weight (as today). System serif/sans fallbacks if loading fails.

**The serif is only for headings of 24 px and up.** Never for controls, chips, labels, body or anything smaller.

## Type scale (phone-first)

| Variant | Family | Size / line height | Tracking | Used for |
|---|---|---|---|---|
| `display` | Lora 400 | 46 / 50 | -1.38 | "Row 12", "Finished" |
| `title` | Lora 400 | 34 / 40 | -0.68 | Screen titles (Stitches, Projects, Settings, project name) |
| `subtitle` | Lora 400 | 24 / 30 | -0.48 | Stitch name on detail, card hero names |
| `heading` | Inter 600 | 18 / 26 | -0.27 | Panel headings (Drawdown, The math, Warp threads) |
| `body` | Inter 400 | 16 / 24 | -0.24 | Body |
| `label` | Inter 500 | 14 / 21 | 0.14 | Field labels |
| `hint` | Inter 400 | 14 / 21 | 0.14 | Secondary text |
| `caption` | Inter 400 | 12 / 18 | 0.12 | Warp numbers, small meta |

`rowNumber` becomes an alias of `display`. Numbers in rows, steppers and warp numbers use `fontVariant: ['tabular-nums']`.

## Colour tokens

Existing token **names stay** (so screens don't churn); their values change, and new tokens are added.

| Token | Light | Dark | Role |
|---|---|---|---|
| `bg` | `#FFF3E7` Canvas | `#17130F` | Page background. Never pure white. |
| `surface` | `#FFFFFF` | `#221D18` | Cards, sheets, bars |
| `surfaceAlt` *(new)* | `#F7F2EC` | `#2A241E` | Inset areas: strip and grid wells, inputs |
| `ink` | `#030302` | `#FFF3E7` | Primary text, filled controls |
| `muted` | `#5C5852` | `#C9BFB3` | Secondary text. Must reach 4.5:1 on both `bg` and `surface`. |
| `graphite` *(new)* | `#41413F` | `#E2D8CC` | Emphasised secondary text |
| `stone` *(new)* | `#BEBBBA` | `#6E665E` | Disabled and decorative only, never readable text |
| `line` | `#E1E1E1` Ash | `#3A332C` | Borders, dividers, input outlines |
| `cloud` *(new)* | `#EFEFEF` | `#2F2923` | Pressed and hover fills |
| `mint` *(new)* | `#9BD8A9` | `#9BD8A9` | Pastel: success, finished, favourite |
| `marigold` *(new)* | `#FDE99B` | `#FDE99B` | Pastel: highlights, tips, current repeat row |
| `periwinkle` *(new)* | `#B8CAF5` | `#B8CAF5` | Pastel: direction pill, info |
| `pastelInk` *(new)* | `#030302` | `#030302` | Text on any pastel fill, both themes |
| `papaya` *(new)* | `#FF4500` | `#FF7A45` | Small accent: current-row frame, focus ring. Never a large fill. |
| `weft` | `#030302` | `#FFF3E7` | "Over" step chip fill, checkbox accent |
| `weftInk` | `#FFFFFF` | `#17130F` | Text on `weft` |
| `warp` / `warpShade` | `#E9DCCB` / `#CDBBA3` | `#5A5148` / `#6E6359` | Neutral warp threads in strips |
| `mark` | = `papaya` | = `papaya` | Current-row outline, focus ring |
| `overChip` | = `periwinkle` | = `periwinkle` | Direction pill |
| `underChip` | `#FFFFFF` | `#2A241E` | "Under" step chip fill (with `line` border), repeat chips |
| `warn` / `warnBg` | `#030302` / `#FDE99B` | `#030302` / `#FDE99B` | Tips and warnings: ink on marigold |
| `btn` / `btnInk` | `#030302` / `#FFFFFF` | `#FFF3E7` / `#17130F` | Primary buttons |

- Pastels keep the same fill in dark mode with dark `pastelInk` text: they read as paper laid on a dark desk.
- Links are `ink` with an underline (Azure fails contrast for text). Azure `#0087FF` is not used.
- Yarn colours (Color A/B defaults and picture palettes) are content: unchanged, never themed.

## Shape and depth

- **Radii:** cards and panels 20; hero cards 24; buttons and inputs 14; primary call to action, chips, pills and segmented controls 9999 (pill); swatches 6; small grid cells 2.
- **Cards** have no border in light mode. Depth comes from layered shadows (React Native `boxShadow` string; supported on web and on the new architecture — check the installed RN types). In dark mode shadows barely show, so cards also get a 1 px `line` border.

| Shadow | Value | Use |
|---|---|---|
| `float` | `0 50px 40px rgba(0,0,0,0.01), 0 50px 40px rgba(0,0,0,0.02), 0 20px 40px rgba(0,0,0,0.05), 0 3px 10px rgba(0,0,0,0.08)` | Cards, panels, hero row card |
| `lift` | `0 12px 12px 2px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)` | Hovered or pressed buttons, sheets, popovers |
| `bar` | `0 1px 3px rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)` | Tab bar and bottom bar (shadow points up) |

Dark mode uses the same shapes with black at roughly 2–3× the opacity.

- **No hard single-source drop shadows and no 0 px corners** on cards or buttons.

## Spacing and layout

- 4 px base. Screen gutter 20. Card padding 24 (20 under 360 px wide). Gap between cards 20. Element gap 8–16.
- Content column stays max 720 px, centred (this is an app, not a marketing page). Screen titles get 8 px top and 20 px bottom breathing room.
- The reference's 96–120 px section gaps are not used.

## Components

- **Primary button:** pill, `btn` fill, `btnInk` text, Inter 600 16, min height 48 (52 in the bottom bar), `lift` shadow on hover and press (web hover; native pressed).
- **Secondary button:** radius 14, `surface` fill, 1 px `line` border, `ink` text.
- **Link button:** `ink` text, underline.
- **Segmented control:** pill track in `surfaceAlt`; the selected segment is a `surface` pill with the `bar` shadow and `ink` text, not an ink fill.
- **Chips** (filters, Start on): pills. Unselected: `surface` with `line` border. Selected: `ink` fill, `btnInk` text.
- **Stepper:** radius 14, `surface` with `line` border, serif-free tabular number.
- **Inputs** (search, hex, rename): radius 14, `surfaceAlt` fill, 1 px `line` border, focus ring `papaya` 2 px.
- **Tip:** marigold pill-cornered box (radius 14), ink text, icon in ink.
- **Tab bar and bottom bar:** `surface`, `bar` shadow pointing up, no top border line in light mode.
- **Sheet:** `surface`, top radius 24, `lift` shadow, a small grab handle in `line`.

### Weaving pieces

- **Over chip:** `weft` (ink) fill, `weftInk` text. **Under chip:** `underChip` fill with `line` border, ink text. Shape: radius 14, not pill, so they read as steps.
- **Repeat chips:** pills; the current one is `marigold` with `pastelInk` text, the others `surface` with `line` border.
- **Direction pill:** `periwinkle`, `pastelInk` text and arrow.
- **Weft tag swatch:** radius 6.
- **Strips and grids** sit in a `surfaceAlt` well with radius 14.
- **Drawdown and picture preview:** the current row is framed in `papaya` (2 px, radius 4). Done rows dim to 55 % as today.
- **"Finished"** uses a `mint` pill with a check.

## Collage accents (`PaperShape`)

- A decorative component in `src/ui`: an SVG shape with a **torn-paper edge**. The edge is a deterministic jagged path from a seed, so it is stable across renders and in screenshots.
- Props: pastel fill (`mint` | `marigold` | `periwinkle` | `sky`); an optional dot-grid texture (`line`-coloured dots at 8 px); rotation of a few degrees; size; the `float` shadow.
- Always absolutely positioned behind content, `pointerEvents="none"`, hidden from accessibility, and clipped so it never causes horizontal scroll.
- `sky` is the gradient `#9ED4EF → #D1EEF9`, used only inside PaperShape.

**Where:**
- behind the Stitches title (top right)
- behind the Quick start and Continue card (offset corner)
- in empty states (Projects, no favorites, no picture yet)
- behind the setup screen's stitch summary
- one small one on Settings' About panel

**Never** in the pattern guide, the picture guide's row card or preview, or anywhere near the bottom bar. At most two shapes visible per screen.

## App identity

- **App icon:** the existing 2/2 twill motif, Ink blocks on a Canvas `#FFF3E7` background, with one Marigold torn-paper square behind the motif. Splash background `#FFF3E7`. Android adaptive background `#FFF3E7`.
- **PWA:** `theme_color` and `background_color` `#FFF3E7`; dark `theme-color` meta `#17130F`.
