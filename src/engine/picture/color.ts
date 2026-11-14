import { mod } from '../math';

/** '#rrggbb' for an r, g, b triple of 0..255 values (rounded per channel). */
export function hex(rgb: readonly number[]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** A plain-English name for a colour, such as "Dark green" or "Light pink". */
export function nameColor(rgb: readonly [number, number, number]): string {
  let [r, g, b] = rgb;
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = mod(h * 60, 360);
  }
  if (l < 0.13) return 'Black';
  if (l > 0.9 && s < 0.5) return 'White';
  if (s < 0.14) return l < 0.35 ? 'Dark gray' : l > 0.7 ? 'Light gray' : 'Gray';
  let n =
    h < 14 ? 'red'
    : h < 40 ? 'orange'
    : h < 66 ? 'yellow'
    : h < 90 ? 'yellow-green'
    : h < 160 ? 'green'
    : h < 195 ? 'teal'
    : h < 255 ? 'blue'
    : h < 290 ? 'purple'
    : h < 352 ? 'pink'
    : 'red';
  if ((n === 'orange' || n === 'red' || n === 'yellow') && l < 0.42 && s < 0.75) n = 'brown';
  const pre = l < 0.3 ? 'dark ' : l > 0.72 ? 'light ' : '';
  const full = pre + n;
  return full[0].toUpperCase() + full.slice(1);
}
