import { test, expect, Page } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

// App Store: 6.5" Display = 1284 x 2778 px
// CSS: 428 x 926 at 3x device scale factor
test.use({
  viewport: { width: 428, height: 926 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

async function hideToasts(page: Page) {
  // Hide toast container entirely for clean screenshots
  await page.evaluate(() => {
    const toasts = document.querySelectorAll('[role="alert"]');
    toasts.forEach((el) => ((el as HTMLElement).style.display = 'none'));
    // Also hide the fixed toast container
    const container = document.querySelector('.fixed.top-4');
    if (container) (container as HTMLElement).style.display = 'none';
  });
  await page.waitForTimeout(100);
}

async function screenshot(page: Page, name: string) {
  await hideToasts(page);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: false,
  });
}

function nav(page: Page) {
  return page.locator('nav[aria-label="Main navigation"]');
}

test.describe('App Store Screenshots', () => {
  test('capture all screens', async ({ page }) => {
    test.setTimeout(120000);
    await createWalletAndUnlock(page);
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 });

    // 01 - Dashboard (Wallet tab - already here)
    await page.waitForTimeout(1000);
    await screenshot(page, '01-dashboard');

    // 02 - P2P tab
    await nav(page).getByRole('link', { name: /p2p/i }).click();
    await page.waitForTimeout(1000);
    await screenshot(page, '02-p2p');

    // 03 - Banking (Dollar tab)
    await nav(page)
      .getByRole('link', { name: /dollar|dólar/i })
      .click();
    await page.waitForTimeout(1000);
    await screenshot(page, '03-banking');

    // 04 - Card (from banking page, click card link)
    const cardLink = page.getByRole('link', { name: /card|tarjeta/i }).first();
    if (await cardLink.isVisible().catch(() => false)) {
      await cardLink.click();
    } else {
      await page.locator('a[href="/banking/card"]').first().click();
    }
    await page.waitForTimeout(1000);
    await screenshot(page, '04-card');

    // 05 - More menu
    await nav(page)
      .getByRole('link', { name: /more|más/i })
      .click();
    await page.waitForTimeout(1000);
    await screenshot(page, '05-more');

    // 06 - Settings (from More menu)
    await page
      .getByRole('link', { name: /settings|ajustes/i })
      .first()
      .click();
    await page.waitForTimeout(1000);
    await screenshot(page, '06-settings');
  });
});
