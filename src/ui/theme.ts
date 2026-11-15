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

const pastels = { mint: '#9BD8A9', marigold: '#FDE99B', periwinkle: '#B8CAF5', pastelInk: '#030302' } as const;

/** "Paper scrapbook" tokens (docs/design.md). Yarn colours are content and never go through here. */
export const lightColors: ThemeColors = {
  bg: '#FFF3E7',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F2EC',
  ink: '#030302',
  muted: '#5C5852',
  graphite: '#41413F',
  stone: '#BEBBBA',
  line: '#E1E1E1',
  cloud: '#EFEFEF',
  ...pastels,
  papaya: '#FF4500',
  weft: '#030302',
  weftInk: '#FFFFFF',
  warp: '#E9DCCB',
  warpShade: '#CDBBA3',
  mark: '#FF4500',
  overChip: pastels.periwinkle,
  underChip: '#FFFFFF',
  warn: '#030302',
  warnBg: pastels.marigold,
  btn: '#030302',
  btnInk: '#FFFFFF',
};

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
  ...pastels,
  papaya: '#FF7A45',
  weft: '#FFF3E7',
  weftInk: '#17130F',
  warp: '#5A5148',
  warpShade: '#6E6359',
  mark: '#FF7A45',
  overChip: pastels.periwinkle,
  underChip: '#2A241E',
  warn: '#030302',
  warnBg: pastels.marigold,
  btn: '#FFF3E7',
  btnInk: '#17130F',
};

/** `sky` fill of PaperShape only: a gradient, top to bottom. */
export const skyGradient = ['#9ED4EF', '#D1EEF9'] as const;

/** 4 px base. `gutter` is the screen's side padding, `card` a card's padding (`cardNarrow` under 360 px), `cardGap` the space between cards. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, gutter: 20, card: 24, cardNarrow: 20, cardGap: 20 } as const;
/**
 * `panel` cards 20, `hero` cards and the sheet's top 24, `button` and `field` (inputs, steppers,
 * step chips, wells, tips) 14, `chip` / `pill` fully round, `swatch` 6, `cell` small grid cells 2.
 */
export const radii = { panel: 20, hero: 24, sheet: 24, button: 14, field: 14, chip: 9999, pill: 9999, swatch: 6, cell: 2 } as const;
/** Minimum touch target, in points. */
export const minTouch = 44;
/** Width of the single content column on wide screens. */
export const maxContentWidth = 720;
/** Below this window width a card's padding drops from 24 to 20. */
export const narrowWidth = 360;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';
/** A text face: one of the sans weights, or the serif (headings of 24 px and up only). */
export type FontFace = FontWeightName | 'serif';

export type TypeVariant = 'display' | 'title' | 'subtitle' | 'heading' | 'body' | 'label' | 'hint' | 'caption' | 'rowNumber';

export type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  face: FontFace;
  letterSpacing?: number;
  tabular?: boolean;
  color: ColorToken;
};

const display: TypeSpec = { fontSize: 46, lineHeight: 50, face: 'serif', letterSpacing: -1.38, tabular: true, color: 'ink' };

export const typeScale: Record<TypeVariant, TypeSpec> = {
  display,
  title: { fontSize: 34, lineHeight: 40, face: 'serif', letterSpacing: -0.68, color: 'ink' },
  subtitle: { fontSize: 24, lineHeight: 30, face: 'serif', letterSpacing: -0.48, color: 'ink' },
  heading: { fontSize: 18, lineHeight: 26, face: 'semibold', letterSpacing: -0.27, color: 'ink' },
  body: { fontSize: 16, lineHeight: 24, face: 'regular', letterSpacing: -0.24, color: 'ink' },
  label: { fontSize: 14, lineHeight: 21, face: 'medium', letterSpacing: 0.14, color: 'muted' },
  hint: { fontSize: 14, lineHeight: 21, face: 'regular', letterSpacing: 0.14, color: 'muted' },
  caption: { fontSize: 12, lineHeight: 18, face: 'regular', letterSpacing: 0.12, color: 'muted' },
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
  serif: serifFamily ? { fontFamily: serifFamily } : systemFaces.serif,
};

export type ShadowName = 'float' | 'lift' | 'bar' | 'segment';
/** View styles carrying a `boxShadow` (iOS, Android and web on React Native 0.88). */
export type ThemeShadows = Record<ShadowName, ViewStyle> & { none: ViewStyle };

/** Layered shadows; `k` scales the opacities (dark mode uses about 2.5×). */
function makeShadows(k: number): ThemeShadows {
  const a = (alpha: number) => `rgba(0,0,0,${Math.min(1, +(alpha * k).toFixed(3))})`;
  return {
    /** Cards, panels, hero row card. */
    float: { boxShadow: `0 50px 40px ${a(0.01)}, 0 50px 40px ${a(0.02)}, 0 20px 40px ${a(0.05)}, 0 3px 10px ${a(0.08)}` },
    /** Hovered or pressed buttons, sheets, popovers. */
    lift: { boxShadow: `0 12px 12px 2px ${a(0.1)}, 0 2px 4px -1px ${a(0.06)}` },
    /** Tab bar and bottom bar: points up. */
    bar: { boxShadow: `0 -1px 3px ${a(0.1)}, 0 -1px 2px -1px ${a(0.1)}` },
    /** The `bar` layers pointing down: the selected segment of a Segmented control. */
    segment: { boxShadow: `0 1px 3px ${a(0.1)}, 0 1px 2px -1px ${a(0.1)}` },
    none: { boxShadow: 'none' },
  };
}

const lightShadows = makeShadows(1);
const darkShadows = makeShadows(2.5);

export type ThemeCards = {
  /** Panel look: surface, radius 20, `float` shadow, 1 px `line` border in dark mode only. No padding. */
  card: ViewStyle;
  /** Hero look: as `card` with radius 24. */
  hero: ViewStyle;
  /** Inset well for strips and grids: `surfaceAlt`, radius 14. No padding. */
  well: ViewStyle;
};

function makeCards(colors: ThemeColors, shadows: ThemeShadows, dark: boolean): ThemeCards {
  const border: ViewStyle = dark ? { borderWidth: 1, borderColor: colors.line } : { borderWidth: 0 };
  return {
    card: { backgroundColor: colors.surface, borderRadius: radii.panel, ...border, ...shadows.float },
    hero: { backgroundColor: colors.surface, borderRadius: radii.hero, ...border, ...shadows.float },
    well: { backgroundColor: colors.surfaceAlt, borderRadius: radii.field },
  };
}

export type Theme = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
  /** `{ ...theme.shadows.float }` in a view style. */
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
