import { buildTheme, contrastRatio, darkColors, lightColors, normalizeHex, radii, typeScale, type ColorToken, type ThemeColors } from './theme';
import { color, radius, shadow } from './tokens';

/** Text on its background, each at least 4.5:1 in both themes (WCAG AA body text). */
const pairs: [ColorToken, ColorToken][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'surfaceAlt'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surfaceAlt'],
  ['graphite', 'bg'],
  ['graphite', 'surface'],
  ['graphite', 'surfaceAlt'],
  ['ink', 'underChip'],
  ['btnInk', 'btn'],
  ['weftInk', 'weft'],
  ['warn', 'warnBg'],
  ['pastelInk', 'mint'],
  ['pastelInk', 'marigold'],
  ['pastelInk', 'periwinkle'],
  ['pastelInk', 'overChip'],
];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});

describe.each<[string, ThemeColors]>([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme', (_name, colors) => {
  it.each(pairs)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme tokens', () => {
  it('builds the light theme from design/tokens.json by role', () => {
    expect(lightColors).toMatchObject({
      bg: color.canvas, surface: color.white, surfaceAlt: color.linen, cloud: color.cloud, line: color.ash,
      ink: color.ink, weft: color.ink, btn: color.ink, pastelInk: color.ink, warn: color.ink,
      muted: color.graphite, graphite: color.graphite, stone: color.stone,
      mint: color.mint, marigold: color.marigold, periwinkle: color.periwinkle, warnBg: color.marigold,
      papaya: color.papaya, mark: color.papaya, overChip: color.periwinkle,
      weftInk: color.white, underChip: color.white, btnInk: color.white,
    });
  });

  it('keeps the derived dark theme', () => {
    expect(darkColors).toEqual({
      bg: '#17130F', surface: '#221D18', surfaceAlt: '#2A241E', ink: '#FFF3E7', muted: '#C9BFB3',
      graphite: '#E2D8CC', stone: '#6E665E', line: '#3A332C', cloud: '#2F2923',
      mint: color.mint, marigold: color.marigold, periwinkle: color.periwinkle, pastelInk: color.ink, papaya: '#FF7A45',
      weft: '#FFF3E7', weftInk: '#17130F', warp: '#5A5148', warpShade: '#6E6359',
      mark: '#FF7A45', overChip: color.periwinkle, underChip: '#2A241E',
      warn: color.ink, warnBg: color.marigold, btn: '#FFF3E7', btnInk: '#17130F',
    });
  });

  it('keep mark and overChip as aliases of papaya and periwinkle', () => {
    for (const colors of [lightColors, darkColors]) {
      expect(colors.mark).toBe(colors.papaya);
      expect(colors.overChip).toBe(colors.periwinkle);
    }
  });
});

describe('radii and shadows', () => {
  it('map role names to token radii', () => {
    expect(radii).toMatchObject({ panel: radius['2xl'], hero: radius['3xl'], sheet: radius['3xl'], button: radius.buttons, field: radius.inputs, pill: radius.pills, swatch: radius.md, frame: radius.md });
  });

  it('expose every token shadow by name, with role aliases', () => {
    const theme = buildTheme('light', false);
    for (const name of Object.keys(shadow) as (keyof typeof shadow)[]) expect(theme.shadows[name]).toEqual({ boxShadow: shadow[name] });
    expect(theme.shadows.float).toBe(theme.shadows.xl);
    expect(theme.shadows.lift).toBe(theme.shadows.md);
    expect(theme.shadows.segment).toBe(theme.shadows.subtle);
    // The bars' shadow is `subtle` pointing up.
    expect(theme.shadows.bar.boxShadow).toBe('rgba(0, 0, 0, 0.1) 0px -1px 3px 0px, rgba(0, 0, 0, 0.1) 0px -1px 2px -1px');
    expect(buildTheme('dark', false).shadows.subtle.boxShadow).toBe('rgba(0, 0, 0, 0.25) 0px 1px 3px 0px, rgba(0, 0, 0, 0.25) 0px 1px 2px -1px');
  });
});

describe('type scale', () => {
  it('uses the serif only for 24 px and up', () => {
    for (const spec of Object.values(typeScale)) {
      if (spec.face === 'serif') expect(spec.fontSize).toBeGreaterThanOrEqual(24);
    }
    expect(typeScale.display.face).toBe('serif');
    expect(typeScale.title.face).toBe('serif');
    expect(typeScale.subtitle.face).toBe('serif');
  });

  it('maps the variants to the named token steps (em tracking in px)', () => {
    expect(typeScale.title).toEqual({ fontSize: 36, lineHeight: 43, letterSpacing: -0.72, face: 'serif', color: 'ink' });
    expect(typeScale.subtitle).toEqual({ fontSize: 24, lineHeight: 29, letterSpacing: -0.72, face: 'serif', color: 'ink' });
    expect(typeScale.heading).toEqual({ fontSize: 18, lineHeight: 25, letterSpacing: -0.36, face: 'medium', color: 'ink' });
    expect(typeScale.body).toEqual({ fontSize: 16, lineHeight: 24, letterSpacing: -0.24, face: 'regular', color: 'ink' });
    expect(typeScale.label).toEqual({ fontSize: 14, lineHeight: 20, letterSpacing: 0, face: 'medium', color: 'muted' });
    expect(typeScale.hint).toEqual({ fontSize: 14, lineHeight: 21, letterSpacing: 0.14, face: 'regular', color: 'muted' });
    expect(typeScale.caption).toEqual({ fontSize: 12, lineHeight: 18, letterSpacing: 0.12, face: 'regular', color: 'muted' });
    expect(typeScale.button).toEqual({ fontSize: 16, lineHeight: 24, letterSpacing: 0, face: 'medium', color: 'ink' });
    expect(typeScale.chip).toEqual({ fontSize: 14, lineHeight: 21, letterSpacing: 0.14, face: 'medium', color: 'ink' });
  });

  it('makes rowNumber an alias of display', () => {
    expect(typeScale.rowNumber).toBe(typeScale.display);
    expect(typeScale.display).toMatchObject({ fontSize: 46, lineHeight: 51, letterSpacing: -1.38 });
    // Proportional figures: Lora's tabular "1" leaves a gap in "Row 1".
    expect(typeScale.display.tabular).toBeFalsy();
  });
});

describe('normalizeHex', () => {
  it('accepts 3 and 6 digit hex with or without #', () => {
    expect(normalizeHex('#2E4C8F')).toBe('#2e4c8f');
    expect(normalizeHex(' abc ')).toBe('#aabbcc');
  });
  it('rejects anything else', () => {
    expect(normalizeHex('#12')).toBeNull();
    expect(normalizeHex('#GGGGGG')).toBeNull();
    expect(normalizeHex('blue')).toBeNull();
    expect(normalizeHex('#1234567')).toBeNull();
  });
});
