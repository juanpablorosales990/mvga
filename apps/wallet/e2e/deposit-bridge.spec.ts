import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

async function navigateSPA(page: import('@playwright/test').Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test.describe('Deposit — Bridge from Tron', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);
    await navigateSPA(page, '/deposit');
  });

  test('Bridge tab is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /bridge from tron|puente desde tron/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('Bridge tab loads deBridge iframe', async ({ page }) => {
    await page.getByRole('button', { name: /bridge from tron|puente desde tron/i }).click();

    const iframe = page.locator('iframe[src*="app.debridge.com"]');
    await expect(iframe).toBeVisible({ timeout: 10000 });
  });

  test('Bridge iframe has correct chain parameters', async ({ page }) => {
    await page.getByRole('button', { name: /bridge from tron|puente desde tron/i }).click();

    const iframe = page.locator('iframe[src*="app.debridge.com"]');
    await expect(iframe).toBeVisible({ timeout: 10000 });

    const src = await iframe.getAttribute('src');
    expect(src).toContain('inputChain=728126428');
    expect(src).toContain('outputChain=7565164');
    expect(src).toContain('inputCurrency=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    expect(src).toContain('outputCurrency=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  test('Bridge info card shows powered by deBridge', async ({ page }) => {
    await page.getByRole('button', { name: /bridge from tron|puente desde tron/i }).click();

    await expect(page.getByText(/powered by debridge|impulsado por debridge/i).first()).toBeVisible(
      { timeout: 10000 }
    );
  });
});
