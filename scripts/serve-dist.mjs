// Tiny static server for the web export. Usage: node scripts/serve-dist.mjs [port] [dir] [base]
// Without a base: serves `dir` at `/`, unknown paths get index.html (SPA fallback).
// With a base (e.g. /oh-a-twill): mimics GitHub Pages for a project site. `dir` is served under
// the base, `/base` redirects to `/base/`, and unknown paths get `dir/404.html` with status 404
// (or a plain 404 when there is none). Paths outside the base are a plain 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] || 8081);
const root = process.argv[3] || 'dist';
const base = (process.argv[4] || '').replace(/\/+$/, '');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function send(res, status, file) {
  try {
    const body = await readFile(file);
    const headers = { 'content-type': types[extname(file)] || 'application/octet-stream' };
    if (base) headers['cache-control'] = 'max-age=600'; // what GitHub Pages sends
    res.writeHead(status, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base) {
    if (path === base) {
      res.writeHead(301, { location: `${base}/` }).end();
      return;
    }
    if (!path.startsWith(`${base}/`)) {
      res.writeHead(404).end('not found');
      return;
    }
    path = path.slice(base.length);
  }
  path = normalize(path).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  if (!(await isFile(file)) && (await isFile(join(file, 'index.html')))) file = join(file, 'index.html');
  if (await isFile(file)) return send(res, 200, file);
  if (base) return send(res, 404, join(root, '404.html'));
  return send(res, 200, join(root, 'index.html'));
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}${base}/`));
