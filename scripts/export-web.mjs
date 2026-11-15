// Web export with PWA extras. Usage:
//   node scripts/export-web.mjs [--base /oh-a-twill] [--output-dir dist] [--skip-export]
// Runs `expo export --platform web` (with EXPO_BASE_URL set to the base, see app.config.js),
// then adds what a PWA needs to the export:
//   - icons/ (192, 512, maskable 512, apple-touch-icon 180) generated from assets/images/icon.png
//   - manifest.webmanifest, and the matching <link>/<meta> tags in index.html
//   - 404.html (a copy of index.html: GitHub Pages serves it for deep links, the router reads the URL)
//   - sw.js (public/sw.js with this build's precache list and version filled in)
// --skip-export only post-processes an existing export (handy when iterating on this script).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertIndexedToRgb, decode, encode } from 'fast-png';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Dark background of the app (src/ui/theme.ts, darkColors.bg). Light comes from app.json.
const DARK_BG = '#17130F';

function parseArgs(argv) {
  const opts = { base: process.env.EXPO_BASE_URL || '', outputDir: 'dist', skipExport: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') opts.base = argv[++i] ?? '';
    else if (arg.startsWith('--base=')) opts.base = arg.slice(7);
    else if (arg === '--output-dir') opts.outputDir = argv[++i];
    else if (arg.startsWith('--output-dir=')) opts.outputDir = arg.slice(13);
    else if (arg === '--skip-export') opts.skipExport = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  opts.base = opts.base.trim().replace(/\/+$/, '');
  if (opts.base && !opts.base.startsWith('/')) throw new Error(`--base must start with "/" (got "${opts.base}")`);
  opts.outputDir = resolve(root, opts.outputDir);
  return opts;
}

// ---------- icons ----------

/** Decode any PNG into 8-bit RGBA. */
function toRgba(png) {
  let { data, channels } = png;
  if (png.palette) {
    data = convertIndexedToRgb(png);
    channels = png.palette[0]?.length ?? 3;
  }
  const n = png.width * png.height;
  const out = new Uint8ClampedArray(n * 4);
  const shift = png.depth === 16 ? 8 : 0;
  for (let i = 0; i < n; i++) {
    const px = (k) => data[i * channels + k] >> shift;
    if (channels >= 3) {
      out[i * 4] = px(0);
      out[i * 4 + 1] = px(1);
      out[i * 4 + 2] = px(2);
      out[i * 4 + 3] = channels === 4 ? px(3) : 255;
    } else {
      const g = px(0);
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g;
      out[i * 4 + 3] = channels === 2 ? px(1) : 255;
    }
  }
  return { width: png.width, height: png.height, data: out };
}

/** Area-average resize (good for downscaling), alpha-weighted so edges do not go dark. */
function resize(img, size) {
  const out = new Uint8ClampedArray(size * size * 4);
  const sx = img.width / size;
  const sy = img.height / size;
  for (let y = 0; y < size; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < size; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0, g = 0, b = 0, a = 0, w = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          const weight = wx * wy;
          const i = (yy * img.width + xx) * 4;
          const alpha = img.data[i + 3] * weight;
          r += img.data[i] * alpha;
          g += img.data[i + 1] * alpha;
          b += img.data[i + 2] * alpha;
          a += alpha;
          w += weight;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = r / a;
        out[o + 1] = g / a;
        out[o + 2] = b / a;
      }
      out[o + 3] = a / w;
    }
  }
  return { width: size, height: size, data: out };
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Draw `img` centred on a `size` square filled with `bg`, scaled to `scale` of the side. */
function onBackground(img, size, bg, scale = 1) {
  const inner = Math.round(size * scale);
  const small = resize(img, inner);
  const [br, bgc, bb] = hexToRgb(bg);
  const out = new Uint8ClampedArray(size * size * 4);
  const off = Math.floor((size - inner) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      let r = br, g = bgc, b = bb;
      const ix = x - off;
      const iy = y - off;
      if (ix >= 0 && iy >= 0 && ix < inner && iy < inner) {
        const i = (iy * inner + ix) * 4;
        const a = small.data[i + 3] / 255;
        r = small.data[i] * a + r * (1 - a);
        g = small.data[i + 1] * a + g * (1 - a);
        b = small.data[i + 2] * a + b * (1 - a);
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return { width: size, height: size, data: out };
}

function isFullBleed(img) {
  const corners = [0, img.width - 1, (img.height - 1) * img.width, img.height * img.width - 1];
  return corners.every((p) => img.data[p * 4 + 3] >= 240);
}

const png = (img) => encode({ width: img.width, height: img.height, data: img.data, channels: 4, depth: 8 });

async function writeIcons(outDir, bg) {
  const source = toRgba(decode(await readFile(join(root, 'assets/images/icon.png'))));
  // A full-bleed square icon (like the app store icon) is used as is for "maskable": its artwork
  // is expected to sit in the central safe zone. An icon with transparent corners is shrunk into
  // the safe zone (the inner 80 % circle) on the app background instead.
  const maskable = isFullBleed(source) ? resize(source, 512) : onBackground(source, 512, bg, 0.7);
  const icons = {
    'icons/icon-192.png': resize(source, 192),
    'icons/icon-512.png': resize(source, 512),
    'icons/maskable-512.png': maskable,
    'icons/apple-touch-icon.png': onBackground(source, 180, bg),
  };
  await mkdir(join(outDir, 'icons'), { recursive: true });
  for (const [path, img] of Object.entries(icons)) await writeFile(join(outDir, path), png(img));
}

// ---------- manifest and html ----------

function manifest(expo, base) {
  const web = expo.web ?? {};
  const bg = web.backgroundColor ?? '#ffffff';
  return {
    id: `${base}/`,
    name: web.name ?? expo.name,
    short_name: web.shortName ?? expo.name,
    lang: web.lang ?? 'en',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    orientation: expo.orientation === 'portrait' ? 'portrait' : 'any',
    background_color: bg,
    theme_color: web.themeColor ?? bg,
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function patchHtml(html, { base, name, light }) {
  if (html.includes('rel="manifest"')) return html; // already patched (--skip-export rerun)
  let out = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
  // Drop any theme-color Expo added from app.json; we add light and dark versions below.
  out = out.replace(/<meta name="theme-color"[^>]*>\s*/g, '');
  const head = [
    `<link rel="manifest" href="${base}/manifest.webmanifest">`,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${light}">`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${DARK_BG}">`,
    `<link rel="apple-touch-icon" href="${base}/icons/apple-touch-icon.png">`,
    `<meta name="apple-mobile-web-app-capable" content="yes">`,
    `<meta name="mobile-web-app-capable" content="yes">`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default">`,
    `<meta name="apple-mobile-web-app-title" content="${escapeAttr(name)}">`,
  ].join('\n');
  if (!out.includes('</head>')) throw new Error('index.html has no </head>');
  return out.replace('</head>', `${head}\n</head>`);
}

// ---------- service worker ----------

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

// Encode a path the way the browser does (WHATWG URL), so cache keys match its requests: e.g.
// `[id]-hash.js` keeps its brackets, a space becomes %20.
const toUrlPath = (path) => new URL(path, 'http://x').pathname;

const NOT_PRECACHED = new Set(['sw.js', '404.html', 'metadata.json', '.nojekyll']);

async function writeServiceWorker(outDir, base) {
  const files = (await listFiles(outDir))
    .map((f) => relative(outDir, f).split(sep).join('/'))
    .filter((f) => !NOT_PRECACHED.has(f) && !f.endsWith('.map'))
    .sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update('\0').update(await readFile(join(outDir, f)));
  const version = hash.digest('hex').slice(0, 16);
  const build = { version, base, files: files.map((f) => toUrlPath(`${base}/${f}`)) };
  const template = await readFile(join(root, 'public/sw.js'), 'utf8');
  const placeholder = "'__OH_A_TWILL_PRECACHE__'";
  if (!template.includes(placeholder)) throw new Error('public/sw.js has no precache placeholder');
  await writeFile(join(outDir, 'sw.js'), template.replace(placeholder, JSON.stringify(build)));
  return build;
}

// ---------- main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.skipExport) {
    const args = ['expo', 'export', '--platform', 'web', '--output-dir', opts.outputDir];
    const env = { ...process.env, EXPO_BASE_URL: opts.base };
    const run = spawnSync('npx', args, { cwd: root, env, stdio: 'inherit' });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
  const outDir = opts.outputDir;
  if (!existsSync(join(outDir, 'index.html'))) throw new Error(`No index.html in ${outDir}`);

  const expo = JSON.parse(await readFile(join(root, 'app.json'), 'utf8')).expo;
  const man = manifest(expo, opts.base);
  await writeIcons(outDir, man.background_color);
  await writeFile(join(outDir, 'manifest.webmanifest'), JSON.stringify(man, null, 2) + '\n');

  const html = patchHtml(await readFile(join(outDir, 'index.html'), 'utf8'), {
    base: opts.base,
    name: man.short_name,
    light: man.theme_color,
  });
  await writeFile(join(outDir, 'index.html'), html);
  await writeFile(join(outDir, '404.html'), html);
  // GitHub Pages: serve folders starting with "_" (Expo puts bundles in _expo/).
  await writeFile(join(outDir, '.nojekyll'), '');

  const build = await writeServiceWorker(outDir, opts.base);
  console.log(`PWA: base "${opts.base || '/'}", ${build.files.length} files precached, version ${build.version}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
