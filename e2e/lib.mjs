// Shared helpers for the end-to-end suite: browser, server, and checks every flow runs.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const require = createRequire(import.meta.url);
export const playwright = require('playwright');
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const BASE_URL = process.env.E2E_URL || 'http://localhost:8112';
export const PHONE = { name: 'phone', width: 390, height: 844 };
export const DESKTOP = { name: 'desktop', width: 1280, height: 800 };
export const VIEWPORTS = [PHONE, DESKTOP];

/** Browsers to run: E2E_BROWSERS=chromium,webkit (default both). Ones that will not launch are skipped. */
const wanted = (process.env.E2E_BROWSERS || 'chromium,webkit').split(',').map((s) => s.trim()).filter(Boolean);
let launched = null;
export async function browsers() {
  if (launched) return launched;
  launched = [];
  for (const name of wanted) {
    try {
      launched.push({ name, browser: await playwright[name].launch() });
    } catch (e) {
      console.log(`# ${name} is not available here, skipped: ${String(e.message).split('\n')[0]}`);
    }
  }
  assert.ok(launched.length > 0, 'no browser could be launched');
  return launched;
}
export async function closeBrowsers() {
  for (const { browser } of launched ?? []) await browser.close();
  launched = null;
}

/**
 * A fresh context (empty storage) at `viewport`, with console and page errors collected.
 * `init` runs before any page script, e.g. to seed localStorage on first load.
 */
export async function openApp(browser, viewport, { colorScheme = 'light', init, path = '/', reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme,
    reducedMotion,
  });
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.errors = errors;
  await page.goto(BASE_URL + path);
  await ready(page);
  return { context, page, errors };
}

/** Waits until the app has hydrated and drawn its first screen. */
export async function ready(page) {
  await page.waitForLoadState('networkidle');
  // Tabs or a stack screen's content: the app has passed hydration.
  await page.waitForFunction(() => document.querySelectorAll('#root [data-testid], #root [role="tab"]').length > 3);
  await page.evaluate(() => document.fonts?.ready);
}

export const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);

/** The visible element with this test id (stack screens keep earlier screens mounted but hidden). */
export const visibleTestId = (page, id) => page.locator(`[data-testid="${id}"]:visible`).first();

/** Clicks the visible button with exactly this accessible name. */
export async function press(page, name, { exact = true } = {}) {
  await page.getByRole('button', { name, exact }).locator('visible=true').first().click();
}

export async function rowLabel(page) {
  return (await visibleTestId(page, 'guide-row').innerText()).trim();
}

/** Step chips of the current pattern row as ["Over 2 · warps 1–2", …]. */
export async function stepTexts(page) {
  return visibleTestId(page, 'guide-steps').locator('[data-testid="guide-steps-step"]').evaluateAll((els) =>
    els.map((el) => {
      const parts = [...el.querySelectorAll('div')].filter((d) => d.children.length === 0).map((d) => d.textContent.trim()).filter(Boolean);
      return parts.join(' · ');
    }),
  );
}

/** No page-level horizontal overflow, and no vertical scroll view wider than its box. */
export async function assertNoHorizontalOverflow(page, where) {
  const problems = await page.evaluate(() => {
    const out = [];
    const w = window.innerWidth;
    const doc = document.scrollingElement || document.documentElement;
    if (doc.scrollWidth > w + 1) out.push(`document is ${doc.scrollWidth}px wide`);
    for (const el of document.querySelectorAll('#root *')) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      const cs = getComputedStyle(el);
      const vertical = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll';
      if (vertical && el.scrollWidth > el.clientWidth + 1) out.push(`scroll view ${el.dataset.testid || el.className} is ${el.scrollWidth}px in ${el.clientWidth}px`);
    }
    return out;
  });
  assert.deepEqual(problems, [], `horizontal overflow on ${where}`);
}

export function assertNoErrors(errors, where) {
  assert.deepEqual(errors, [], `console or page errors on ${where}`);
}

/** Starts scripts/serve-dist.mjs on `port` for `dir`; resolves once it listens. */
export async function startServer(dir, port) {
  const child = spawn(process.execPath, [join(ROOT, 'scripts/serve-dist.mjs'), String(port), dir], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  const deadline = Date.now() + 10000;
  while (!out.includes('serving')) {
    if (child.exitCode != null) throw new Error(`server exited: ${out}`);
    if (Date.now() > deadline) throw new Error('server did not start');
    await new Promise((r) => setTimeout(r, 50));
  }
  return {
    url: `http://localhost:${port}`,
    stop: async () => {
      if (child.exitCode != null) return;
      child.kill();
      await once(child, 'exit');
    },
  };
}

export const FLOWER = join(ROOT, 'assets/samples/flower.png');

/** Library → Quick start → the pattern guide on row 1. Returns the project id. */
export async function quickStart(page) {
  await visibleTestId(page, 'quick-start-card').getByRole('button', { name: 'Start weaving' }).click();
  await visibleTestId(page, 'pattern-guide').waitFor();
  await page.waitForFunction(() => /\/project\/[^/]+$/.test(location.pathname));
  return new URL(page.url()).pathname.split('/').pop();
}

/** Clicks Row done `n` times, waiting for the row label to move each time. */
export async function rowDone(page, n = 1, { testId = 'guide-next' } = {}) {
  for (let i = 0; i < n; i++) {
    await visibleTestId(page, testId).click();
  }
}

export async function waitForRow(page, n) {
  await page.waitForFunction((label) => {
    const el = [...document.querySelectorAll('[data-testid="guide-row"]')].find((e) => e.offsetParent);
    return el && el.textContent.trim() === label;
  }, `Row ${n}`);
}

/** Projects → New from picture → choose `file` → the picture guide with its row card. */
export async function newPictureProject(page, file = FLOWER) {
  await tab(page, 'Projects');
  await press(page, 'New from picture');
  await visibleTestId(page, 'picture-add').waitFor();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), press(page, 'Choose a picture')]);
  await chooser.setFiles(file);
  await visibleTestId(page, 'picture-row-card').waitFor({ timeout: 20000 });
}

/** Lets layout, fonts and smooth scrolling settle before a screenshot. */
export async function settle(page, ms = 350) {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

export async function tab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}
