// Side by side with the old web app (reference/web/index.html): the same steps for rows 1–8
// of 2/2 twill on 24 warps (PLAN.md WP12). The app has no step chips; it gives the steps as the
// strip's screen reader sentence and the first step as the "Start: …" hint, so both are compared
// against the reference's step chips.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { PHONE, ROOT, assertNoErrors, browsers, closeBrowsers, openApp, quickStart, rowDone, startHint, stepSentence, waitForRow } from './lib.mjs';

const REFERENCE = pathToFileURL(join(ROOT, 'reference/web/index.html')).href;
const ROWS = 8;

/**
 * The reference's row card turned into what the app shows: the screen reader sentence built from
 * its direction and step chips, and the start hint built from its first chip.
 */
async function referenceRow(page) {
  return page.evaluate(() => {
    const card = document.querySelector('#rowCard');
    const row = card.querySelector('.row-num').textContent.trim();
    const dir = card.querySelector('.dir').textContent.trim().toLowerCase();
    const items = [...card.querySelectorAll('ol.steps li')].map((li) => ({
      word: li.querySelector('b').textContent.trim().toLowerCase(),
      warps: li.querySelector('small').textContent.trim(),
    }));
    const firstWarp = items[0].warps.match(/\d+/)[0];
    return {
      sentence: `${row}, ${dir}: ${items.map((x) => x.word).join(', ')}`,
      start: `Start: ${items[0].word} at warp ${firstWarp}`,
      first: `${items[0].word} · ${items[0].warps}`,
    };
  });
}

const list = await browsers();
after(closeBrowsers);

for (const { name, browser } of list) {
  describe(`${name}: reference parity`, () => {
    it(`2/2 twill on 24 warps, rows 1–${ROWS}: same steps as the old web app`, { timeout: 120_000 }, async () => {
      // The reference, fresh (its defaults are 2/2 twill, 24 warps, row 1 starting at the left).
      const refContext = await browser.newContext({ viewport: { width: PHONE.width, height: PHONE.height } });
      const ref = await refContext.newPage();
      const refErrors = [];
      ref.on('pageerror', (e) => refErrors.push(e.message));
      await ref.goto(REFERENCE);
      await ref.locator('#rowCard ol.steps li').first().waitFor();

      const { page, errors, context } = await openApp(browser, PHONE);
      await quickStart(page);

      const theirs = [];
      const ours = [];
      for (let r = 1; r <= ROWS; r++) {
        assert.match(await ref.locator('#rowCard .row-num').innerText(), new RegExp(`^Row ${r}$`));
        await waitForRow(page, r);
        theirs.push(await referenceRow(ref));
        ours.push({ sentence: await stepSentence(page), start: await startHint(page) });
        if (r < ROWS) {
          await ref.click('#next');
          await rowDone(page, 1);
        }
      }
      for (let r = 0; r < ROWS; r++) {
        assert.equal(ours[r].sentence, theirs[r].sentence, `row ${r + 1} steps`);
        assert.equal(ours[r].start, theirs[r].start, `row ${r + 1} start`);
      }
      // Sanity: the fixed 2/2 twill order (PLAN.md section 6, item 1) shows in the first steps.
      assert.equal(theirs[0].first, 'over 2 · warps 1–2');
      assert.equal(theirs[1].first, 'over 1 · warp 24');
      assert.equal(ours[1].start, 'Start: over 1 at warp 24');
      assert.deepEqual(refErrors, []);
      assertNoErrors(errors, 'reference parity');
      await refContext.close();
      await context.close();
    });
  });
}
