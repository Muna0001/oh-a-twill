// Side by side with the old web app (reference/web/index.html): the same step text for
// rows 1–8 of 2/2 twill on 24 warps (PLAN.md WP12).
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { PHONE, ROOT, assertNoErrors, browsers, closeBrowsers, openApp, quickStart, rowDone, stepTexts, waitForRow } from './lib.mjs';

const REFERENCE = pathToFileURL(join(ROOT, 'reference/web/index.html')).href;
const ROWS = 8;

/** Step chips of the reference's row card as ["Over 2 · warps 1–2", …]. */
async function referenceSteps(page) {
  return page.locator('#rowCard ol.steps li').evaluateAll((items) =>
    items.map((li) => `${li.querySelector('b').textContent.trim()} · ${li.querySelector('small').textContent.trim()}`),
  );
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
        theirs.push(await referenceSteps(ref));
        ours.push(await stepTexts(page));
        if (r < ROWS) {
          await ref.click('#next');
          await rowDone(page, 1);
        }
      }
      for (let r = 0; r < ROWS; r++) assert.deepEqual(ours[r], theirs[r], `row ${r + 1}`);
      // Sanity: the fixed 2/2 twill order (PLAN.md section 6, item 1) shows in the first steps.
      assert.equal(theirs[0][0], 'Over 2 · warps 1–2');
      assert.equal(theirs[1][0], 'Over 1 · warp 24');
      assert.deepEqual(refErrors, []);
      assertNoErrors(errors, 'reference parity');
      await refContext.close();
      await context.close();
    });
  });
}
