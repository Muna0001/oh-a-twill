import { contrastRatio, darkColors, lightColors, normalizeHex, type ColorToken, type ThemeColors } from './theme';

const pairs: [ColorToken, ColorToken][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'surface'],
  ['btnInk', 'btn'],
  ['weftInk', 'weft'],
  ['warn', 'warnBg'],
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
  it('match the web CSS exactly', () => {
    expect(lightColors).toEqual({
      bg: '#EEF1EC', surface: '#FFFFFF', ink: '#1C2333', muted: '#5A6375', line: '#D5DAD1',
      weft: '#2E4C8F', weftInk: '#FFFFFF', warp: '#D8D1C0', warpShade: '#C2B9A4',
      mark: '#D9A521', overChip: '#E2E8F5', underChip: '#EDEAE2',
      warn: '#7A5100', warnBg: '#FBF0D3', btn: '#1C2333', btnInk: '#FFFFFF',
    });
    expect(darkColors).toEqual({
      bg: '#11151D', surface: '#1A202B', ink: '#E6E9EF', muted: '#9AA3B5', line: '#2C3342',
      weft: '#7C98DC', weftInk: '#0F1420', warp: '#4B505D', warpShade: '#5E6474',
      mark: '#E8BE55', overChip: '#22314F', underChip: '#2C2F38',
      warn: '#F0C66A', warnBg: '#352B15', btn: '#E6E9EF', btnInk: '#11151D',
    });
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
