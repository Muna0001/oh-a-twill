// Generates src/ui/tokens.ts from the owner's design files (the source of truth):
//   design/tokens.json     design tokens (color, font, typography steps, spacing, radius, shadow)
//   design/variables.css   :root CSS variables (adds the text/leading/tracking scale, weights,
//                          layout, named radii and the sky gradient)
// Usage:
//   node scripts/build-tokens.mjs            write src/ui/tokens.ts
//   node scripts/build-tokens.mjs --stdout   print what would be written (the freshness test uses this)
// No dependencies. Fails if the two files disagree on a value they both define.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/ui/tokens.ts');

const json = JSON.parse(readFileSync(join(ROOT, 'design/tokens.json'), 'utf8'));
const css = readFileSync(join(ROOT, 'design/variables.css'), 'utf8');

// ---------- parse ----------

/** `--name: value;` pairs inside :root, in file order (comments stripped). */
function cssVars(text) {
  const body = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const vars = new Map();
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars.set(m[1], m[2].trim());
  return vars;
}
const vars = cssVars(css);
const take = (prefix) => [...vars].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]);

const fail = (msg) => {
  throw new Error(`build-tokens: ${msg}`);
};

/** "12px" → 12. Anything else fails. */
function px(value, where) {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  if (!m) fail(`${where}: expected a px value, got "${value}"`);
  return Number(m[1]);
}
/** "12px" → 12, "96-120px" → { min: 96, max: 120 }. */
function pxOrRange(value, where) {
  const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  return px(value, where);
}
/** "-0.02em" → -0.02. */
function em(value, where) {
  const m = /^(-?\d+(?:\.\d+)?)em$/.exec(String(value).trim());
  if (!m) fail(`${where}: expected an em value, got "${value}"`);
  return Number(m[1]);
}
const hex = (rgb) => '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');

/** Same value in both files, compared case-insensitively and ignoring spaces. */
function agree(name, a, b) {
  const norm = (v) => String(v).toLowerCase().replace(/\s+/g, '');
  if (norm(a) !== norm(b)) fail(`${name} differs: tokens.json "${a}" vs variables.css "${b}"`);
}

// color
const color = {};
for (const [name, t] of Object.entries(json.color)) {
  color[name] = String(t.$value).toLowerCase();
  if (vars.has(`color-${name}`)) agree(`color.${name}`, color[name], vars.get(`color-${name}`));
}
for (const [name, v] of take('color-')) if (!(name in color)) color[name] = v.toLowerCase();

// gradients: keep the CSS, and the stops as hex for SVG / native (which cannot do `in oklab`)
const gradient = {};
for (const [name, v] of take('gradient-')) {
  const stops = [...v.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g)].map((m) => hex([m[1], m[2], m[3]].map(Number)));
  const space = /\bin\s+([a-z-]+)/.exec(v)?.[1] ?? 'srgb';
  gradient[name] = { css: v, stops, interpolation: space };
}

// fonts
const font = {};
for (const [name, t] of Object.entries(json.font)) font[name] = { family: t.$value, stack: vars.get(`font-${name}`) ?? t.$value };

const fontWeight = Object.fromEntries(take('font-weight-').map(([k, v]) => [k, Number(v)]));

// typography steps (tokens.json); letter spacing stays in em, as given
const typography = {};
for (const [name, t] of Object.entries(json.typography)) {
  const v = t.$value;
  typography[name] = {
    fontFamily: v.fontFamily,
    fontSize: px(v.fontSize, `typography.${name}.fontSize`),
    fontWeight: Number(v.fontWeight),
    lineHeight: Number(v.lineHeight),
    letterSpacingEm: em(v.letterSpacing, `typography.${name}.letterSpacing`),
  };
}

// CSS text scale: --text-X (size), --leading-X (ratio), --tracking-X (px)
const text = {};
for (const [name, v] of take('text-')) {
  text[name] = {
    fontSize: px(v, `--text-${name}`),
    lineHeight: Number(vars.get(`leading-${name}`) ?? fail(`--leading-${name} missing`)),
    letterSpacing: px(vars.get(`tracking-${name}`) ?? fail(`--tracking-${name} missing`), `--tracking-${name}`),
  };
}

// spacing
const spacing = {};
for (const [name, t] of Object.entries(json.spacing)) {
  spacing[name] = px(t.$value, `spacing.${name}`);
  if (vars.has(`spacing-${name}`)) agree(`spacing.${name}`, t.$value, vars.get(`spacing-${name}`));
}

// radius: the scale, then the named radii (a range stays { min, max })
const radius = {};
for (const [name, t] of Object.entries(json.radius)) {
  radius[name] = px(t.$value, `radius.${name}`);
  if (vars.has(`radius-${name}`)) agree(`radius.${name}`, t.$value, vars.get(`radius-${name}`));
}
for (const [name, v] of take('radius-')) if (!(name in radius)) radius[name] = pxOrRange(v, `--radius-${name}`);

// shadow
const shadow = {};
for (const [name, t] of Object.entries(json.shadow)) {
  shadow[name] = t.$value;
  if (vars.has(`shadow-${name}`)) agree(`shadow.${name}`, t.$value, vars.get(`shadow-${name}`));
}

// layout
const layout = {};
for (const key of ['page-max-width', 'section-gap', 'card-padding', 'element-gap']) {
  if (vars.has(key)) layout[key] = pxOrRange(vars.get(key), `--${key}`);
}

// ---------- emit ----------

const str = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const ident = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) || /^(0|[1-9]\d*)$/.test(k) ? k : str(k));
function lit(value, indent = '') {
  if (typeof value === 'string') return str(value);
  if (value === null || typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map((v) => lit(v, indent)).join(', ')}]`;
  const inner = indent + '  ';
  const flat = Object.values(value).every((v) => v === null || typeof v !== 'object');
  const entries = Object.entries(value).map(([k, v]) => `${ident(k)}: ${lit(v, inner)}`);
  if (flat && entries.join(', ').length + inner.length < 120) return `{ ${entries.join(', ')} }`;
  return `{\n${entries.map((e) => `${inner}${e},`).join('\n')}\n${indent}}`;
}
const block = (doc, name, value) => `/** ${doc} */\nexport const ${name} = ${lit(value)} as const;\n`;

const output = [
  '// Generated by scripts/build-tokens.mjs from design/tokens.json and design/variables.css.',
  '// Do not edit: change those files and run `npm run tokens`. A test fails if this file is stale.',
  '',
  block('Colours (`--color-*`).', 'color', color),
  block('Gradients (`--gradient-*`): the CSS, its stops as hex, and its interpolation space.', 'gradient', gradient),
  block('Font families from tokens.json with their CSS stacks (`--font-*`).', 'font', font),
  block('Font weights (`--font-weight-*`).', 'fontWeight', fontWeight),
  block('Typography steps from tokens.json. Sizes in px; `lineHeight` is a ratio; letter spacing in em.', 'typography', typography),
  block('CSS text scale: `--text-*` size (px), `--leading-*` ratio, `--tracking-*` letter spacing (px).', 'text', text),
  block('Spacing scale in px (`--spacing-*`).', 'spacing', spacing),
  block('Radius scale and named radii in px (`--radius-*`); a range is `{ min, max }`.', 'radius', radius),
  block('Shadows (`--shadow-*`) as CSS box-shadow strings.', 'shadow', shadow),
  block('Layout (`--page-max-width` …) in px; a range is `{ min, max }`.', 'layout', layout),
  `export type ColorName = keyof typeof color;
export type TypographyStep = keyof typeof typography;
export type TextStep = keyof typeof text;
export type SpacingStep = keyof typeof spacing;
export type RadiusName = keyof typeof radius;
export type ShadowToken = keyof typeof shadow;
`,
].join('\n');

if (process.argv.includes('--stdout')) process.stdout.write(output);
else {
  writeFileSync(OUT, output);
  console.log(`wrote ${OUT}`);
}
