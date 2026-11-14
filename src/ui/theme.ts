import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme, type TextStyle } from 'react-native';

import { fontFamilies } from './fonts';

export type ThemeScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeScheme;

export type ThemeColors = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  weft: string;
  weftInk: string;
  warp: string;
  warpShade: string;
  mark: string;
  overChip: string;
  underChip: string;
  warn: string;
  warnBg: string;
  btn: string;
  btnInk: string;
};
export type ColorToken = keyof ThemeColors;

/** Tokens from the web app's CSS. Yarn colours are content and never go through here. */
export const lightColors: ThemeColors = {
  bg: '#EEF1EC',
  surface: '#FFFFFF',
  ink: '#1C2333',
  muted: '#5A6375',
  line: '#D5DAD1',
  weft: '#2E4C8F',
  weftInk: '#FFFFFF',
  warp: '#D8D1C0',
  warpShade: '#C2B9A4',
  mark: '#D9A521',
  overChip: '#E2E8F5',
  underChip: '#EDEAE2',
  warn: '#7A5100',
  warnBg: '#FBF0D3',
  btn: '#1C2333',
  btnInk: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  bg: '#11151D',
  surface: '#1A202B',
  ink: '#E6E9EF',
  muted: '#9AA3B5',
  line: '#2C3342',
  weft: '#7C98DC',
  weftInk: '#0F1420',
  warp: '#4B505D',
  warpShade: '#5E6474',
  mark: '#E8BE55',
  overChip: '#22314F',
  underChip: '#2C2F38',
  warn: '#F0C66A',
  warnBg: '#352B15',
  btn: '#E6E9EF',
  btnInk: '#11151D',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radii = { panel: 14, button: 10, field: 8, swatch: 4, chip: 999 } as const;
/** Minimum touch target, in points. */
export const minTouch = 44;
/** Width of the single content column on wide screens. */
export const maxContentWidth = 720;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';

export type TypeVariant = 'title' | 'heading' | 'body' | 'hint' | 'label' | 'rowNumber';

type TypeSpec = {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightName;
  letterSpacing?: number;
  tabular?: boolean;
  color: ColorToken;
};

export const typeScale: Record<TypeVariant, TypeSpec> = {
  title: { fontSize: 28, lineHeight: 32, weight: 'bold', letterSpacing: -0.28, color: 'ink' },
  heading: { fontSize: 17, lineHeight: 23, weight: 'semibold', color: 'ink' },
  body: { fontSize: 16, lineHeight: 23, weight: 'regular', color: 'ink' },
  hint: { fontSize: 14, lineHeight: 20, weight: 'regular', color: 'muted' },
  label: { fontSize: 14, lineHeight: 20, weight: 'medium', color: 'muted' },
  rowNumber: { fontSize: 44, lineHeight: 46, weight: 'bold', letterSpacing: -0.88, tabular: true, color: 'ink' },
};

const systemWeights: Record<FontWeightName, TextStyle> = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
};

/**
 * One explicit family per weight (Android does not synthesise weights, and on web each
 * family holds a single face, so no fontWeight is set alongside it).
 */
const loadedWeights: Record<FontWeightName, TextStyle> = {
  regular: { fontFamily: fontFamilies.regular },
  medium: { fontFamily: fontFamilies.medium },
  semibold: { fontFamily: fontFamilies.semibold },
  bold: { fontFamily: fontFamilies.bold },
};

export type Theme = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof typeScale;
  minTouch: number;
  maxContentWidth: number;
  /** Spread into a text style to pick a weight: `{ ...theme.fonts.semibold }`. */
  fonts: Record<FontWeightName, TextStyle>;
};

export function buildTheme(scheme: ThemeScheme, fontsLoaded: boolean): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    type: typeScale,
    minTouch,
    maxContentWidth,
    fonts: fontsLoaded ? loadedWeights : systemWeights,
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
