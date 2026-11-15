import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import { fontFamilies, serifFamily, systemSerif } from './fonts';
import {
  color,
  font,
  fontWeight,
  gradient,
  layout,
  radius,
  shadow,
  spacing as space,
  text,
  typography,
  type ShadowToken,
  type TextStep,
  type TypographyStep,
} from './tokens';

export type ThemeScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeScheme;

export type ThemeColors = {
  /** Page background (Canvas). Never pure white. */
  bg: string;
  /** Cards, sheets, bars. */
  surface: string;
  /** Inset areas: strip and grid wells, inputs. */
  surfaceAlt: string;
  /** Primary text, filled controls. */
  ink: string;
  /** Secondary text (4.5:1 on `bg` and `surface`). */
  muted: string;
  /** Emphasised secondary text. */
  graphite: string;
  /** Disabled and decorative only, never readable text. */
  stone: string;
  /** Borders, dividers, input outlines. */
  line: string;
  /** Pressed and hover fills. */
  cloud: string;
  /** Pastel: success, finished, favourite. Same in both themes; text on it is `pastelInk`. */
  mint: string;
  /** Pastel: highlights, tips, current repeat row. */
  marigold: string;
  /** Pastel: direction pill, info. */
  periwinkle: string;
  /** Text on any pastel fill, both themes. */
  pastelInk: string;
  /** Small accent: current-row frame, focus ring. Never a large fill. */
  papaya: string;
  /** "Over" step chip fill, checkbox accent. */
  weft: string;
  /** Text on `weft`. */
  weftInk: string;
  /** Neutral warp threads in picture strips. */
  warp: string;
  warpShade: string;
  /** Current-row outline, focus ring (= papaya). */
  mark: string;
  /** Direction pill (= periwinkle). */
  overChip: string;
  /** "Under" step chip fill (with a `line` border), repeat chips. */
  underChip: string;
  /** Tips and warnings: ink on marigold. */
  warn: string;
  warnBg: string;
  /** Primary buttons. */
  btn: string;
  btnInk: string;
};
export type ColorToken = keyof ThemeColors;
/** Pastel fills that take `pastelInk` text. */
export type PastelToken = 'mint' | 'marigold' | 'periwinkle';

/** Mixes two `#rrggbb` colours: `t` = 0 gives `a`, 1 gives `b`. */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Light theme: every value comes from design/tokens.json via `tokens.ts` (docs/design.md,
 * "Token source of truth"). Yarn colours are content and never go through here.
 */
export const lightColors: ThemeColors = {
  bg: color.canvas,
  surface: color.white,
  surfaceAlt: color.linen,
  ink: color.ink,
  muted: color.graphite,
  graphite: color.graphite,
  stone: color.stone,
  line: color.ash,
  cloud: color.cloud,
  mint: color.mint,
  marigold: color.marigold,
  periwinkle: color.periwinkle,
  pastelInk: color.ink,
  papaya: color.papaya,
  weft: color.ink,
  weftInk: color.white,
  // The tokens have no warp colour: neutral threads are canvas toned down with graphite.
  warp: mix(color.canvas, color.graphite, 0.12),
  warpShade: mix(color.canvas, color.graphite, 0.24),
  mark: color.papaya,
  overChip: color.periwinkle,
  underChip: color.white,
  warn: color.ink,
  warnBg: color.marigold,
  btn: color.ink,
  btnInk: color.white,
};

/** Dark theme: derived by us (the tokens are light only), same roles. Pastels and `pastelInk` stay as in light. */
export const darkColors: ThemeColors = {
  bg: '#17130F',
  surface: '#221D18',
  surfaceAlt: '#2A241E',
  ink: '#FFF3E7',
  muted: '#C9BFB3',
  graphite: '#E2D8CC',
  stone: '#6E665E',
  line: '#3A332C',
  cloud: '#2F2923',
  mint: color.mint,
  marigold: color.marigold,
  periwinkle: color.periwinkle,
  pastelInk: color.ink,
  papaya: '#FF7A45',
  weft: '#FFF3E7',
  weftInk: '#17130F',
  warp: '#5A5148',
  warpShade: '#6E6359',
  mark: '#FF7A45',
  overChip: color.periwinkle,
  underChip: '#2A241E',
  warn: color.ink,
  warnBg: color.marigold,
  btn: '#FFF3E7',
  btnInk: '#17130F',
};

/** `sky` fill of PaperShape only (`--gradient-sky`), top to bottom. Drawn in sRGB: SVG cannot interpolate `in oklab`. */
export const skyGradient = gradient.sky.stops;

/**
 * Role names on the token spacing scale (`tokens.spacing`). `gutter` is the screen's side
 * padding, `card` a card's padding (`--card-padding`; `cardNarrow` under 360 px), `cardGap` the
 * space between cards.
 */
export const spacing = {
  xs: space[4],
  sm: space[8],
  md: space[12],
  lg: space[16],
  xl: space[20],
  xxl: space[32],
  gutter: space[20],
  card: layout['card-padding'],
  cardNarrow: space[20],
  cardGap: space[20],
} as const;
/**
 * Role names on the token radii: `panel` cards (`2xl`), `hero` cards and the sheet's top (`3xl`),
 * `button` and `field` (inputs, steppers, step chips, wells, tips: `buttons` / `inputs`),
 * `chip` / `pill` (`pills`), `swatch` and `frame` (`md`). `cell` (2) is for grid cells: a drawing, not a UI surface.
 */
export const radii = {
  panel: radius['2xl'],
  hero: radius['3xl'],
  sheet: radius['3xl'],
  button: radius.buttons,
  field: radius.inputs,
  chip: radius.pills,
  pill: radius.pills,
  swatch: radius.md,
  frame: radius.md,
  cell: 2,
} as const;
/** Minimum touch target, in points (platform guideline, not a design token). */
export const minTouch = 44;
/** Width of the single content column on wide screens (an app column, not `--page-max-width`). */
export const maxContentWidth = 720;
/** Below this window width a card's padding drops from 24 to 20. */
export const narrowWidth = 360;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';
/** A text face: one of the sans weights, or the serif (headings of 24 px and up only). */
export type FontFace = FontWeightName | 'serif';

export type TypeVariant =
  | 'display'
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'body'
  | 'label'
  | 'hint'
  | 'caption'
  | 'button'
  | 'chip'
  | 'rowNumber';

export type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  face: FontFace;
  letterSpacing?: number;
  tabular?: boolean;
  color: ColorToken;
};

const faceOf = (weight: number): FontWeightName =>
  weight >= fontWeight.bold ? 'bold' : weight >= fontWeight.semibold ? 'semibold' : weight >= fontWeight.medium ? 'medium' : 'regular';
const round2 = (n: number) => Math.round(n * 100) / 100;

/** From a CSS text step (`--text-*`: tracking already in px). */
function fromText(step: TextStep, face: FontFace, tone: ColorToken = 'ink'): TypeSpec {
  const t = text[step];
  return { fontSize: t.fontSize, lineHeight: Math.round(t.fontSize * t.lineHeight), letterSpacing: t.letterSpacing, face, color: tone };
}
/** From a typography step (letter spacing in em, converted to px). Serif steps map to the serif face. */
function fromStep(step: TypographyStep, tone: ColorToken = 'ink'): TypeSpec {
  const t = typography[step];
  const face: FontFace = t.fontFamily === font.untitledseriffont.family ? 'serif' : faceOf(t.fontWeight);
  return { fontSize: t.fontSize, lineHeight: Math.round(t.fontSize * t.lineHeight), letterSpacing: round2(t.letterSpacingEm * t.fontSize), face, color: tone };
}

const display = fromText('heading', 'serif');

/** Variants mapped to the named token steps (docs/design.md, "Type"). */
export const typeScale: Record<TypeVariant, TypeSpec> = {
  display,
  title: fromText('heading-sm', 'serif'),
  subtitle: fromStep('2xl'),
  heading: fromStep('lg'),
  body: fromText('body', 'regular'),
  label: fromStep('sm-4', 'muted'),
  hint: fromText('body-sm', 'regular', 'muted'),
  caption: fromText('caption', 'regular', 'muted'),
  /** Button labels (`base-5`). */
  button: fromStep('base-5'),
  /** Chip labels (`sm-6`). */
  chip: fromStep('sm-6'),
  /** Alias of `display`. */
  rowNumber: display,
};

const systemFaces: Record<FontFace, TextStyle> = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  serif: { fontFamily: systemSerif, fontWeight: '400' },
};

/**
 * One explicit family per weight (Android does not synthesise weights, and on web each
 * family holds a single face, so no fontWeight is set alongside it).
 */
const loadedFaces: Record<FontFace, TextStyle> = {
  regular: { fontFamily: fontFamilies.regular },
  medium: { fontFamily: fontFamilies.medium },
  semibold: { fontFamily: fontFamilies.semibold },
  bold: { fontFamily: fontFamilies.bold },
  serif: { fontFamily: serifFamily },
};

/**
 * Shadows by token name (`xl`, `sm`, `md`, `md-2`, `subtle`, `md-3`), plus role aliases:
 * `float` = `xl` (cards), `lift` = `md` (hovered or pressed buttons, sheets), `bar` = `subtle`
 * mirrored to point up (tab bar, bottom bar), `segment` = `subtle` (segmented thumb), `hover` =
 * `md-3` (card hover on web).
 */
export type ShadowName = ShadowToken | 'float' | 'lift' | 'bar' | 'segment' | 'hover';
/** View styles carrying a `boxShadow` (iOS, Android and web on React Native 0.88). */
export type ThemeShadows = Record<ShadowName, ViewStyle> & { none: ViewStyle };

/** Splits a CSS shadow list on the commas outside parentheses. */
function layers(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of css) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A token shadow with its alphas scaled by `k` and, with `up`, its y offsets mirrored. */
function adjust(css: string, k: number, up = false): string {
  return layers(css)
    .map((layer) => {
      let out = layer.replace(/rgba\(([^)]*)\)/, (_m, args: string) => {
        const parts = args.split(',').map((p) => p.trim());
        parts[3] = String(Math.min(1, round2(Number(parts[3] ?? 1) * k)));
        return `rgba(${parts.join(', ')})`;
      });
      if (up) {
        // Lengths after the colour: x, y, blur, spread. Flip y.
        let n = 0;
        out = out.replace(/(-?\d*\.?\d+)px/g, (m, v: string) => (++n === 2 ? `${-Number(v)}px` : m));
      }
      return out;
    })
    .join(', ');
}

function makeShadows(k: number): ThemeShadows {
  const by = Object.fromEntries((Object.keys(shadow) as ShadowToken[]).map((name) => [name, { boxShadow: adjust(shadow[name], k) }])) as Record<ShadowToken, ViewStyle>;
  return {
    ...by,
    float: by.xl,
    lift: by.md,
    bar: { boxShadow: adjust(shadow.subtle, k, true) },
    segment: by.subtle,
    hover: by['md-3'],
    none: { boxShadow: 'none' },
  };
}

const lightShadows = makeShadows(1);
/** Shadows barely show on a dark desk: same shapes, 2.5× the opacity. */
const darkShadows = makeShadows(2.5);

export type ThemeCards = {
  /** Panel look: surface, radius `2xl`, `xl` shadow, 1 px `line` border in dark mode only. No padding. */
  card: ViewStyle;
  /** Hero look: as `card` with radius `3xl`. */
  hero: ViewStyle;
  /** Inset well for strips and grids: `surfaceAlt` (linen), radius `xl`. No padding. */
  well: ViewStyle;
};

function makeCards(colors: ThemeColors, shadows: ThemeShadows, dark: boolean): ThemeCards {
  const border: ViewStyle = dark ? { borderWidth: 1, borderColor: colors.line } : { borderWidth: 0 };
  return {
    card: { backgroundColor: colors.surface, borderRadius: radii.panel, ...border, ...shadows.xl },
    hero: { backgroundColor: colors.surface, borderRadius: radii.hero, ...border, ...shadows.xl },
    well: { backgroundColor: colors.surfaceAlt, borderRadius: radii.field },
  };
}

export type Theme = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
  /** `theme.shadows.xl` (or its role alias `float`) in a view style. */
  shadows: ThemeShadows;
  /** Ready-made surfaces: `[theme.cards.card, { padding: theme.spacing.card }]`. */
  cards: ThemeCards;
  minTouch: number;
  maxContentWidth: number;
  /** Spread into a text style to pick a face: `{ ...theme.fonts.semibold }`, `{ ...theme.fonts.serif }`. */
  fonts: Record<FontFace, TextStyle>;
};

const lightCards = makeCards(lightColors, lightShadows, false);
const darkCards = makeCards(darkColors, darkShadows, true);

export function buildTheme(scheme: ThemeScheme, fontsLoaded: boolean): Theme {
  const dark = scheme === 'dark';
  return {
    scheme,
    colors: dark ? darkColors : lightColors,
    spacing,
    radii,
    type: typeScale,
    shadows: dark ? darkShadows : lightShadows,
    cards: dark ? darkCards : lightCards,
    minTouch,
    maxContentWidth,
    fonts: fontsLoaded ? loadedFaces : systemFaces,
  };
}

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const fallbackValue: ThemeContextValue = {
  theme: buildTheme('light', false),
  preference: 'system',
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(fallbackValue);

export type ThemeProviderProps = {
  children: ReactNode;
  /** Starting preference. Default 'system'. */
  initialPreference?: ThemePreference;
  /** True once the bundled font is registered; false falls back to the system font. */
  fontsLoaded?: boolean;
};

export function ThemeProvider({ children, initialPreference = 'system', fontsLoaded = false }: ThemeProviderProps) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);
  const scheme: ThemeScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<ThemeContextValue>(
    () => ({ theme: buildTheme(scheme, fontsLoaded), preference, setPreference }),
    [scheme, fontsLoaded, preference, setPreference],
  );
  return createElement(ThemeContext.Provider, { value }, children);
}

/** Resolved tokens for the current scheme. Works without a provider (light, system font). */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** `[preference, setPreference]`; Settings wires this to the store. */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const { preference, setPreference } = useContext(ThemeContext);
  return [preference, setPreference];
}

/** Accepts `#RGB` or `#RRGGBB` (the `#` is optional) and returns `#rrggbb`, or null. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return `#${hex}`;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const n = normalizeHex(hex) ?? '#000000';
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
