// Accessibility and polish checks (PLAN.md WP12): names, states, keyboard, zoom, reduced motion.
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import {
  BASE_URL,
  DESKTOP,
  PHONE,
  assertNoErrors,
  assertNoHorizontalOverflow,
  browsers,
  closeBrowsers,
  openApp,
  quickStart,
  rowDone,
  settle,
  visibleTestId,
  waitForRow,
} from './lib.mjs';

const T = { timeout: 120_000 };

/** What has keyboard focus, and whether it draws a visible focus ring. */
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
    return { name: el.getAttribute('aria-label') || el.textContent.trim(), role: el.getAttribute('role') || el.tagName.toLowerCase(), ring };
  });

async function tabThrough(page, count) {
  const seen = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
    seen.push(await focused(page));
  }
  return seen;
}

/** Text that is cut off: wider or taller than its box, unless it is meant to be shortened with "…". */
const clippedText = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#root div[dir="auto"]')]
      .filter((el) => el.offsetParent && getComputedStyle(el).textOverflow !== 'ellipsis' && getComputedStyle(el).webkitLineClamp === 'none')
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)
      .map((el) => el.textContent.slice(0, 40)),
  );

const list = await browsers();
after(closeBrowsers);

for (const { name, browser } of list) {
  describe(`${name}: accessibility`, () => {
    it('stitch detail: the back button and the Front/Back switch have different names', T, async () => {
      const { page, errors, context } = await openApp(browser, PHONE, { path: '/stitch/twill22' });
      await visibleTestId(page, 'detail-preview').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Back', exact: true }).count(), 1);
      const front = page.getByRole('radio', { name: 'Front of the cloth' });
      const back = page.getByRole('radio', { name: 'Back of the cloth' });
      assert.equal(await front.getAttribute('aria-checked'), 'true');
      await back.click();
      assert.equal(await back.getAttribute('aria-checked'), 'true');
      assert.equal(await front.getAttribute('aria-checked'), 'false');
      assert.match(await visibleTestId(page, 'detail-preview').getAttribute('aria-label'), /, back$/);
      assertNoErrors(errors, 'stitch detail');
      await context.close();
    });

    it('selected states reach screen readers: filters, tabs, checkboxes, the math', T, async () => {
      const { page, errors, context } = await openApp(browser, PHONE);
      assert.equal(await page.getByRole('radiogroup', { name: 'Show stitches' }).count(), 1);
      const radio = (name) => page.getByRole('radio', { name, exact: true });
      assert.equal(await radio('All').getAttribute('aria-checked'), 'true');
      await radio('Twills').click();
      assert.equal(await radio('Twills').getAttribute('aria-checked'), 'true');
      assert.equal(await radio('All').getAttribute('aria-checked'), 'false');
      assert.equal(await page.getByRole('tab', { name: 'Stitches' }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected'), 'false');

      await page.getByRole('tab', { name: 'Settings' }).click();
      const awake = page.getByRole('checkbox', { name: 'Keep the screen awake while weaving' });
      assert.equal(await awake.getAttribute('aria-checked'), 'true');
      await awake.click();
      assert.equal(await awake.getAttribute('aria-checked'), 'false');

      await page.goto(BASE_URL + '/');
      await quickStart(page);
      const math = page.getByRole('button', { name: 'The math' });
      assert.equal(await math.getAttribute('aria-expanded'), 'false');
      await math.click();
      assert.equal(await math.getAttribute('aria-expanded'), 'true');
      assertNoErrors(errors, 'states');
      await context.close();
    });

    it('keyboard: Tab reaches the guide controls in order, with a visible focus ring', T, async () => {
      const { page, errors, context } = await openApp(browser, PHONE);
      await quickStart(page);
      await rowDone(page, 1);
      await waitForRow(page, 2);
      await settle(page);
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      const seen = await tabThrough(page, 7);
      const names = seen.map((s) => s.name);
      const order = ['Back', 'Project settings, 24 warps', 'Back to row 1', 'Drawdown', 'The math', 'Previous row', 'Row done'];
      assert.deepEqual(names, order);
      for (const s of seen) assert.ok(s.ring, `focus ring on ${s.name}`);
      // Enter on the focused Row done advances.
      await page.keyboard.press('Enter');
      await waitForRow(page, 3);
      assertNoErrors(errors, 'keyboard guide');
      await context.close();
    });

    it('keyboard: the project sheet takes focus, Escape closes it, Enter renames', T, async () => {
      const { page, errors, context } = await openApp(browser, PHONE);
      await quickStart(page);
      await page.goto(BASE_URL + '/projects');
      const more = page.getByRole('button', { name: 'More for 2/2 twill' });
      await more.focus();
      await page.keyboard.press('Enter');
      const sheet = visibleTestId(page, 'project-menu');
      await sheet.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close');
      await settle(page);
      assert.equal(await page.getByRole('dialog').count(), 1);
      await page.keyboard.press('Escape');
      await sheet.waitFor({ state: 'detached' });
      // Focus goes back to the button that opened it.
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'More for 2/2 twill');

      await page.keyboard.press('Enter');
      await sheet.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close');
      await settle(page);
      await page.keyboard.press('Tab');
      assert.equal((await focused(page)).name, 'Name');
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('Wall hanging');
      await page.keyboard.press('Enter');
      await sheet.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'More for Wall hanging' }).waitFor();
      assertNoErrors(errors, 'keyboard sheet');
      await context.close();
    });

    it('reduced motion: the sheet opens without its fade', T, async () => {
      const { page, errors, context } = await openApp(browser, PHONE, { reducedMotion: 'reduce' });
      await quickStart(page);
      await page.goto(BASE_URL + '/projects');
      await page.getByRole('button', { name: 'More for 2/2 twill' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const animations = await page.evaluate(() => document.getAnimations().map((a) => a.animationName ?? a.constructor.name));
      assert.deepEqual(animations, []);
      // Without the fade the modal is active at once, so Escape works straight away.
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assertNoErrors(errors, 'reduced motion');
      await context.close();
    });

    // 200% browser zoom on a 390 px phone leaves 195 CSS px; on a 1280 px desktop, 640.
    // 320 px is the WCAG reflow width.
    for (const vp of [
      { label: 'phone at 200%', width: PHONE.width / 2, height: PHONE.height / 2 },
      { label: 'desktop at 200%', width: DESKTOP.width / 2, height: DESKTOP.height / 2 },
      { label: '320 px', width: 320, height: 568 },
    ]) {
      it(`text zoom: ${vp.label}, the library and the guide fit without cut-off text`, T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await settle(page);
        await assertNoHorizontalOverflow(page, `library, ${vp.label}`);
        assert.deepEqual(await clippedText(page), [], `library text, ${vp.label}`);
        await quickStart(page);
        await rowDone(page, 1);
        await waitForRow(page, 2);
        await settle(page);
        await assertNoHorizontalOverflow(page, `guide, ${vp.label}`);
        assert.deepEqual(await clippedText(page), [], `guide text, ${vp.label}`);
        // The bar's buttons stay on screen and do not overlap.
        const prev = await visibleTestId(page, 'guide-prev').boundingBox();
        const next = await visibleTestId(page, 'guide-next').boundingBox();
        assert.ok(next.x + next.width <= vp.width + 1 && prev.x >= 0);
        const overlap = !(prev.x + prev.width <= next.x || next.y >= prev.y + prev.height || prev.y >= next.y + next.height);
        assert.ok(!overlap, 'Back and Row done overlap');
        assertNoErrors(errors, `zoom ${vp.label}`);
        await context.close();
      });
    }

    it('desktop: the content column is centred and at most 720 px wide', T, async () => {
      const { page, errors, context } = await openApp(browser, DESKTOP);
      const box = await visibleTestId(page, 'quick-start-card').boundingBox();
      const left = box.x;
      const right = DESKTOP.width - (box.x + box.width);
      assert.ok(Math.abs(left - right) <= 2, `centred (${left} vs ${right})`);
      assert.ok(box.width <= 720 - 32, `width ${box.width}`);
      const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      assert.ok(tabs[2].right - tabs[0].left <= 720, 'tab bar items sit in the same column');
      assertNoErrors(errors, 'desktop');
      await context.close();
    });
  });
}
