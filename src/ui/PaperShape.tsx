import { useId, useMemo } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { skyGradient, useTheme, type PastelToken } from './theme';

export type PaperColor = PastelToken | 'sky';

export type PaperShapeProps = {
  /** Pastel fill. 'sky' is the blue gradient used only here. Default 'marigold'. */
  color?: PaperColor;
  /** Width in points. Default 120. */
  width?: number;
  /** Height in points. Default `width`. */
  height?: number;
  /** Picks the torn edge. The same seed always draws the same edge. Default 1. */
  seed?: number;
  /** Degrees; a few either way. Default -4. */
  rotate?: number;
  /** `line`-coloured dot grid at 8 px. Default false. */
  dots?: boolean;
  /** Soft `float`-like shadow under the paper. Default true. */
  shadow?: boolean;
  /**
   * Position it, e.g. `{ top: -12, right: -16 }`. It is always absolutely positioned; the parent
   * should clip (`overflow: 'hidden'`) where it could cause sideways scrolling.
   */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** mulberry32: a tiny seeded PRNG, so edges are stable across renders and in screenshots. */
function random(seed: number): () => number {
  let a = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A rough rectangle with torn-paper edges inside `width` × `height`, as SVG path data.
 * Pure and deterministic: the same arguments always give the same string.
 */
export function paperPath(seed: number, width: number, height: number): string {
  const rand = random(seed);
  const inset = Math.max(3, Math.min(width, height) * 0.05);
  const tear = Math.max(1.5, Math.min(width, height) * 0.035);
  const pts: [number, number][] = [];
  // Walk the four edges clockwise; each step jitters perpendicular to the edge.
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(3, Math.round(len / (5 + rand() * 4)));
    for (let i = 0; i < steps; i++) {
      const t = (i + (i === 0 ? 0 : rand() * 0.5 - 0.25)) / steps;
      const j = (rand() - 0.35) * tear * (rand() < 0.15 ? 2.2 : 1);
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  };
  const l = inset;
  const t = inset;
  const r = width - inset;
  const b = height - inset;
  edge(l, t, r, t, 0, -1);
  edge(r, t, r, b, 1, 0);
  edge(r, b, l, b, 0, 1);
  edge(l, b, l, t, -1, 0);
  return `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`;
}

/** Dot centres on an 8 px grid inside the shape's box. */
function dotGrid(width: number, height: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 8; y < height; y += 8) for (let x = 8; x < width; x += 8) out.push([x, y]);
  return out;
}

/**
 * Decorative torn-paper collage shape. Always absolutely positioned behind content, ignores
 * touches, and is hidden from screen readers. Never use it in the weaving guides.
 */
export function PaperShape({ color = 'marigold', width = 120, height, seed = 1, rotate = -4, dots = false, shadow = true, style, testID }: PaperShapeProps) {
  const theme = useTheme();
  const h = height ?? width;
  const d = useMemo(() => paperPath(seed, width, h), [seed, width, h]);
  const grid = useMemo(() => (dots ? dotGrid(width, h) : []), [dots, width, h]);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = { sky: `paper-sky-${uid}`, clip: `paper-clip-${uid}` };
  const fill = color === 'sky' ? `url(#${ids.sky})` : theme.colors[color];
  const dark = theme.scheme === 'dark';
  // Web draws a real soft shadow that follows the torn edge; native gets a faint offset copy.
  const webShadow =
    shadow && Platform.OS === 'web'
      ? ({ filter: `drop-shadow(0 12px 14px rgba(0,0,0,${dark ? 0.14 : 0.06})) drop-shadow(0 2px 4px rgba(0,0,0,${dark ? 0.2 : 0.08}))` } as ViewStyle)
      : null;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[{ position: 'absolute', width, height: h, transform: [{ rotate: `${rotate}deg` }] }, webShadow, style]}>
      <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        <Defs>
          {color === 'sky' ? (
            <LinearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={skyGradient[0]} />
              <Stop offset="1" stopColor={skyGradient[1]} />
            </LinearGradient>
          ) : null}
          {dots ? (
            <ClipPath id={ids.clip}>
              <Path d={d} />
            </ClipPath>
          ) : null}
        </Defs>
        {shadow && Platform.OS !== 'web' ? <Path d={d} fill="#000000" opacity={dark ? 0.18 : 0.06} transform="translate(0 3)" /> : null}
        <Path d={d} fill={fill} />
        {dots ? (
          <G clipPath={`url(#${ids.clip})`}>
            {grid.map(([x, y]) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={theme.colors.line} opacity={dark ? 0.6 : 0.9} />
            ))}
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
