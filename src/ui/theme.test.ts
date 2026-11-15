import { contrastRatio, darkColors, lightColors, normalizeHex, typeScale, type ColorToken, type ThemeColors } from './theme';

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
  it('match docs/design.md exactly', () => {
    expect(lightColors).toEqual({
      bg: '#FFF3E7', surface: '#FFFFFF', surfaceAlt: '#F7F2EC', ink: '#030302', muted: '#5C5852',
      graphite: '#41413F', stone: '#BEBBBA', line: '#E1E1E1', cloud: '#EFEFEF',
      mint: '#9BD8A9', marigold: '#FDE99B', periwinkle: '#B8CAF5', pastelInk: '#030302', papaya: '#FF4500',
      weft: '#030302', weftInk: '#FFFFFF', warp: '#E9DCCB', warpShade: '#CDBBA3',
      mark: '#FF4500', overChip: '#B8CAF5', underChip: '#FFFFFF',
      warn: '#030302', warnBg: '#FDE99B', btn: '#030302', btnInk: '#FFFFFF',
    });
    expect(darkColors).toEqual({
      bg: '#17130F', surface: '#221D18', surfaceAlt: '#2A241E', ink: '#FFF3E7', muted: '#C9BFB3',
      graphite: '#E2D8CC', stone: '#6E665E', line: '#3A332C', cloud: '#2F2923',
      mint: '#9BD8A9', marigold: '#FDE99B', periwinkle: '#B8CAF5', pastelInk: '#030302', papaya: '#FF7A45',
      weft: '#FFF3E7', weftInk: '#17130F', warp: '#5A5148', warpShade: '#6E6359',
      mark: '#FF7A45', overChip: '#B8CAF5', underChip: '#2A241E',
      warn: '#030302', warnBg: '#FDE99B', btn: '#FFF3E7', btnInk: '#17130F',
    });
  });

  it('keep mark and overChip as aliases of papaya and periwinkle', () => {
    for (const colors of [lightColors, darkColors]) {
      expect(colors.mark).toBe(colors.papaya);
      expect(colors.overChip).toBe(colors.periwinkle);
    }
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

  it('makes rowNumber an alias of display', () => {
    expect(typeScale.rowNumber).toBe(typeScale.display);
    expect(typeScale.display).toMatchObject({ fontSize: 46, lineHeight: 50, letterSpacing: -1.38 });
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
