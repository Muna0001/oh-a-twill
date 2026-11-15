// The main flows (PLAN.md WP12), in every available browser at phone and desktop size.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  BASE_URL,
  VIEWPORTS,
  assertNoErrors,
  assertNoHorizontalOverflow,
  browsers,
  closeBrowsers,
  newPictureProject,
  openApp,
  press,
  quickStart,
  rowDone,
  rowLabel,
  stepTexts,
  tab,
  visibleTestId,
  waitForRow,
} from './lib.mjs';

const T = { timeout: 120_000 };

/** The old helper's saved state, shaped like `S` in reference/web/index.html (JSON.stringify(S)). */
const LEGACY_STATE = {
  warps: 32,
  mode: 'pat',
  pat: 'herring',
  start: 0,
  mirror: false,
  side: 'left',
  colors: ['#2E4C8F', '#E4DCC8'],
  row: 17,
  pic: { src: null, rows: 0, k: 4, tidy: true, row: 1, weave: 'twill22' },
};

const list = await browsers();
after(closeBrowsers);

for (const { name: browserName, browser } of list) {
  for (const vp of VIEWPORTS) {
    describe(`${browserName} ${vp.width}×${vp.height}`, () => {
      it('Quick start, three rows done, reload: still on row 4', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await quickStart(page);
        assert.equal(await rowLabel(page), 'Row 1');
        await rowDone(page, 3);
        await waitForRow(page, 4);
        const url = page.url();
        await page.reload();
        await visibleTestId(page, 'pattern-guide').waitFor();
        assert.equal(page.url(), url);
        assert.equal(await rowLabel(page), 'Row 4');
        // The library offers to continue it.
        await page.goto(BASE_URL + '/');
        const card = visibleTestId(page, 'continue-card');
        await card.waitFor();
        assert.match(await card.innerText(), /Row 4 · 24 warps/);
        assertNoErrors(errors, 'quick start');
        await context.close();
      });

      it('row 2 of 2/2 twill on 24 warps reads right to left, starting "Over 1" at warp 24', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await quickStart(page);
        await rowDone(page, 1);
        await waitForRow(page, 2);
        assert.match(await visibleTestId(page, 'guide-direction').innerText(), /Right to left/);
        const steps = await stepTexts(page);
        assert.equal(steps[0], 'Over 1 · warp 24');
        assert.equal(steps.at(-1), 'Over 1 · warp 1');
        assertNoErrors(errors, 'row 2');
        await context.close();
      });

      it('← and → move rows, but not while typing in the warp field', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        const id = await quickStart(page);
        await page.keyboard.press('ArrowRight');
        await waitForRow(page, 2);
        await page.keyboard.press('ArrowRight');
        await waitForRow(page, 3);
        await page.keyboard.press('ArrowLeft');
        await waitForRow(page, 2);

        // The warp field is in the project settings, opened from the guide header.
        await visibleTestId(page, 'guide-setup').click();
        await page.waitForURL(`**/project/${id}/setup`);
        const field = page.getByRole('textbox', { name: 'Number of warp threads' }).locator('visible=true').first();
        await field.click();
        for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(key);
        await field.press('End');
        await field.press('Backspace');
        await field.press('Backspace');
        await field.type('28');
        await field.press('ArrowLeft');
        await field.press('Enter');
        await press(page, 'Done');
        await page.waitForURL(`**/project/${id}`);
        await visibleTestId(page, 'pattern-guide').waitFor();
        await waitForRow(page, 2);
        assert.match(await visibleTestId(page, 'guide-setup').innerText(), /28 warps/);
        // Back on the guide the keys work again.
        await page.keyboard.press('ArrowLeft');
        await waitForRow(page, 1);
        await page.keyboard.press('ArrowLeft');
        await waitForRow(page, 1);
        assertNoErrors(errors, 'arrow keys');
        await context.close();
      });

      it('Library: search "hound", Houndstooth, Start weaving, 8-row repeat', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await visibleTestId(page, 'library-search').fill('hound');
        const cards = page.locator('[data-testid="stitch-grid"] [role="button"]');
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="stitch-grid"] [role="button"]').length === 1);
        assert.match(await cards.first().getAttribute('aria-label'), /^Houndstooth\./);
        await cards.first().click();
        await visibleTestId(page, 'detail-preview').waitFor();
        await visibleTestId(page, 'start-weaving').click();
        await page.waitForURL('**/project/new?stitch=hounds');
        await page.getByText('3 repeats of 8, clean edges').locator('visible=true').first().waitFor();
        await press(page, 'Start weaving');
        await visibleTestId(page, 'pattern-guide').waitFor();
        assert.equal(await rowLabel(page), 'Row 1');
        assert.match(await visibleTestId(page, 'guide-repeat-line').innerText(), /Row 1 of the 8-row repeat\./);
        const repeat = await visibleTestId(page, 'guide-repeat').innerText();
        for (let k = 1; k <= 8; k++) assert.match(repeat, new RegExp(`${k}\\. `));
        assert.match(await visibleTestId(page, 'guide-weft').innerText(), /Weft: Color A/);
        await rowDone(page, 4);
        await waitForRow(page, 5);
        assert.match(await visibleTestId(page, 'guide-repeat-line').innerText(), /Row 5 of the 8-row repeat\./);
        assert.match(await visibleTestId(page, 'guide-weft').innerText(), /Weft: Color B/);
        assertNoErrors(errors, 'houndstooth');
        await context.close();
      });

      it('New from picture: the flower, 4 colors, Row done to the end, Finished', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await newPictureProject(page);
        const palette = page.getByRole('list', { name: 'Yarn colors' }).locator('visible=true').first();
        assert.equal(await palette.locator(':scope > *').count(), 4);
        assert.match(await page.locator('#root').innerText(), /24 warps by \d+ rows, 4 yarn colors/);
        const H = Number((await page.locator('#root').innerText()).match(/24 warps by (\d+) rows/)[1]);
        assert.ok(H >= 4);

        // Arrow keys do nothing while typing in this screen's warp field.
        const field = page.getByRole('textbox', { name: 'Number of warp threads' }).locator('visible=true').first();
        await field.click();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await field.blur();
        assert.match(await visibleTestId(page, 'picture-bar').innerText(), /Row 1/);

        for (let r = 1; r <= H; r++) await visibleTestId(page, 'picture-next').click();
        const card = visibleTestId(page, 'picture-row-card');
        await page.waitForFunction(() => {
          const el = [...document.querySelectorAll('[data-testid="picture-row-card"]')].find((e) => e.offsetParent);
          return el && /Finished/.test(el.innerText);
        });
        assert.match(await card.innerText(), new RegExp(`All ${H} rows are woven\\. Nice work\\.`));
        assert.ok(await visibleTestId(page, 'picture-next').isDisabled());

        await page.goto(BASE_URL + '/projects');
        await page.getByText(/^Finished · 24 warps$/).first().waitFor();
        assertNoErrors(errors, 'picture');
        await context.close();
      });

      it('rename, duplicate and delete a project', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        await quickStart(page);
        await page.goto(BASE_URL + '/projects');
        const menu = async (name) => {
          await page.getByRole('button', { name: `More for ${name}` }).click();
          await visibleTestId(page, 'project-menu').waitFor();
        };
        const rows = () => page.locator('[data-testid^="project-row-"]').locator('visible=true');

        await menu('2/2 twill');
        const nameField = page.getByRole('textbox', { name: 'Name' });
        await nameField.fill('Blue scarf');
        await nameField.press('Enter');
        await page.getByRole('button', { name: 'More for Blue scarf' }).waitFor();
        await visibleTestId(page, 'project-menu').waitFor({ state: 'detached' });

        await menu('Blue scarf');
        await press(page, 'Duplicate');
        await page.getByRole('button', { name: 'More for Blue scarf copy' }).waitFor();
        assert.equal(await rows().count(), 2);

        await menu('Blue scarf copy');
        await press(page, 'Delete');
        await press(page, 'Delete “Blue scarf copy”');
        await page.getByRole('button', { name: 'More for Blue scarf copy' }).waitFor({ state: 'detached' });
        assert.equal(await rows().count(), 1);

        // The changes are saved.
        await page.reload();
        await page.getByRole('button', { name: 'More for Blue scarf' }).waitFor();
        assert.equal(await rows().count(), 1);
        assertNoErrors(errors, 'projects');
        await context.close();
      });

      it('Settings: Dark switches the theme and survives a reload', T, async () => {
        const { page, errors, context } = await openApp(browser, vp, { colorScheme: 'light' });
        const background = () => visibleTestId(page, 'settings-screen').evaluate((el) => getComputedStyle(el).backgroundColor);
        await tab(page, 'Settings');
        await visibleTestId(page, 'settings-screen').waitFor();
        const light = await background();
        await page.getByRole('radio', { name: 'Dark' }).click();
        await page.waitForFunction((before) => {
          const el = [...document.querySelectorAll('[data-testid="settings-screen"]')].find((e) => e.offsetParent);
          return el && getComputedStyle(el).backgroundColor !== before;
        }, light);
        const dark = await background();
        assert.ok(isDark(dark), `expected a dark background, got ${dark}`);
        await page.reload();
        await visibleTestId(page, 'settings-screen').waitFor();
        assert.equal(await background(), dark);
        assert.equal(await page.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked'), 'true');
        assertNoErrors(errors, 'settings');
        await context.close();
      });

      it('legacy import: the offer, "Bring it over", the project at the saved row, the old key untouched', T, async () => {
        const saved = JSON.stringify(LEGACY_STATE);
        const { page, errors, context } = await openApp(browser, vp, {
          init: {
            fn: (value) => {
              // Seed once, before the first load only, like the old helper on the same origin.
              if (!sessionStorage.getItem('seeded')) {
                localStorage.setItem('weaving-helper-v3', value);
                sessionStorage.setItem('seeded', '1');
              }
            },
            arg: saved,
          },
        });
        const offer = visibleTestId(page, 'legacy-offer');
        await offer.waitFor();
        assert.match(await offer.innerText(), /Bring over your weaving from the old helper/);
        assert.equal(await page.locator('[data-testid="quick-start-card"]').count(), 0, 'Quick start waits for the answer');
        await press(page, 'Bring it over');
        const card = visibleTestId(page, 'continue-card');
        await card.waitFor();
        await offer.waitFor({ state: 'detached' });
        assert.match(await card.innerText(), /Herringbone/);
        assert.match(await card.innerText(), /Row 17 · 32 warps/);
        await card.getByRole('button', { name: 'Continue weaving Herringbone' }).click();
        await visibleTestId(page, 'pattern-guide').waitFor();
        assert.equal(await rowLabel(page), 'Row 17');
        assert.equal(await page.evaluate(() => localStorage.getItem('weaving-helper-v3')), saved);
        // Answered once: not offered again.
        await page.goto(BASE_URL + '/');
        await card.waitFor();
        assert.equal(await page.locator('[data-testid="legacy-offer"]').count(), 0);
        assertNoErrors(errors, 'legacy import');
        await context.close();
      });

      it('no horizontal overflow and no errors on any screen', T, async () => {
        const { page, errors, context } = await openApp(browser, vp);
        const check = async (where) => assertNoHorizontalOverflow(page, `${where} at ${vp.width}px`);
        await check('library');
        // The library scrolls inside the page and the tab bar stays on screen.
        const tabBox = await page.getByRole('tab', { name: 'Stitches' }).boundingBox();
        assert.ok(tabBox && tabBox.y + tabBox.height <= vp.height + 1, 'tab bar is on screen');
        await page.goto(BASE_URL + '/stitch/twill22');
        await visibleTestId(page, 'detail-preview').waitFor();
        await check('stitch detail');
        await visibleTestId(page, 'start-weaving').click();
        await page.getByText(/repeats of 4/).locator('visible=true').first().waitFor();
        await check('setup');
        await page.goto(BASE_URL + '/');
        await quickStart(page);
        await check('pattern guide');
        await page.goto(BASE_URL + '/projects');
        await press(page, 'New from picture');
        await visibleTestId(page, 'picture-add').waitFor();
        await check('picture guide, empty');
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), press(page, 'Choose a picture')]);
        await chooser.setFiles(new URL('../assets/samples/flower.png', import.meta.url).pathname);
        await visibleTestId(page, 'picture-row-card').waitFor({ timeout: 20000 });
        await check('picture guide');
        await page.goto(BASE_URL + '/projects');
        await page.getByText('Picture 1').first().waitFor();
        await check('projects');
        await tab(page, 'Settings');
        await visibleTestId(page, 'settings-screen').waitFor();
        await check('settings');
        await page.goto(BASE_URL + '/project/nope');
        await visibleTestId(page, 'project-missing').waitFor();
        await check('project not found');
        assertNoErrors(errors, 'screens');
        await context.close();
      });
    });
  }
}

function isDark(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.3;
}

before(() => console.log(`# e2e against ${BASE_URL}`));
