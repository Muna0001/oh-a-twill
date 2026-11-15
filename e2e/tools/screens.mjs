// Screenshots of every screen, light and dark. Needs a served web export.
// Usage: node e2e/tools/screens.mjs <outDir> [phone|desktop|both]   (E2E_URL, default http://localhost:8112)
// docs/screens/ is refreshed with: node e2e/tools/screens.mjs docs/screens phone
// (phone mode also writes desktop-library-light.png: the library at 1280×800).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { DESKTOP, FLOWER, PHONE, openApp, playwright, press, quickStart, rowDone, settle, tab, visibleTestId, waitForRow } from '../lib.mjs';

const out = process.argv[2] || 'docs/screens';
const which = process.argv[3] || 'phone';
const viewports = which === 'both' ? [PHONE, DESKTOP] : which === 'desktop' ? [DESKTOP] : [PHONE];
mkdirSync(out, { recursive: true });

const browser = await playwright.chromium.launch();
for (const vp of viewports) {
  for (const scheme of ['light', 'dark']) {
    const suffix = `${viewports.length > 1 ? `-${vp.name}` : ''}-${scheme}`;
    const shot = async (page, name, opts = {}) => {
      await settle(page);
      await page.screenshot({ path: join(out, `${name}${suffix}.png`), ...opts });
    };
    const { page, context } = await openApp(browser, vp, { colorScheme: scheme });

    await shot(page, '01-library');
    await page.goto(new URL('/stitch/hounds', page.url()).href);
    await visibleTestId(page, 'detail-preview').waitFor();
    await shot(page, '02-stitch-detail');
    await visibleTestId(page, 'start-weaving').click();
    await page.getByText('3 repeats of 8, clean edges').locator('visible=true').first().waitFor();
    await shot(page, '03-setup');

    await page.goto(new URL('/', page.url()).href);
    await visibleTestId(page, 'quick-start-card').waitFor();
    await quickStart(page);
    await rowDone(page, 3);
    await waitForRow(page, 4);
    await shot(page, '04-pattern-guide');
    await page.goto(new URL('/', page.url()).href);
    await visibleTestId(page, 'continue-card').waitFor();
    await shot(page, '05-library-continue');

    await tab(page, 'Projects');
    await page.getByRole('button', { name: 'New from picture' }).first().waitFor();
    await press(page, 'New from picture');
    await visibleTestId(page, 'picture-add').waitFor();
    await shot(page, '06-picture-empty');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), press(page, 'Choose a picture')]);
    await chooser.setFiles(FLOWER);
    await visibleTestId(page, 'picture-row-card').waitFor({ timeout: 20000 });
    await shot(page, '07-picture-guide');
    await rowDone(page, 2, { testId: 'picture-next' });
    await shot(page, '08-picture-row3');

    await page.goto(new URL('/projects', page.url()).href);
    await page.getByText('Picture 1').first().waitFor();
    await shot(page, '09-projects');
    await tab(page, 'Settings');
    await page.getByText('Appearance').first().waitFor();
    await shot(page, '10-settings');
    await context.close();
  }
}
if (which === 'phone') {
  const { page, context } = await openApp(browser, DESKTOP, { colorScheme: 'light' });
  await visibleTestId(page, 'stitch-grid').waitFor();
  await settle(page);
  await page.screenshot({ path: join(out, 'desktop-library-light.png') });
  await context.close();
}
await browser.close();
console.log(`screens written to ${out}`);
