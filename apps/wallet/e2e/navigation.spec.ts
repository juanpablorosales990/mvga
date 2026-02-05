import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('loads the wallet page by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('MVGA', { exact: true })).toBeVisible();
  });

  test('bottom nav links navigate correctly', async ({ page }) => {
    await page.goto('/');

    // Navigate to Swap
    await page.getByRole('link', { name: /swap|cambiar/i }).click();
    await expect(page).toHaveURL('/swap');

    // Navigate to Stake
    await page.getByRole('link', { name: /stake|staking/i }).click();
    await expect(page).toHaveURL('/stake');

    // Navigate to P2P
    await page.getByRole('link', { name: /p2p/i }).click();
    await expect(page).toHaveURL('/p2p');

    // Navigate to More
    await page.getByRole('link', { name: /more|mas/i }).click();
    await expect(page).toHaveURL('/more');

    // Navigate back to Wallet
    await page.getByRole('link', { name: /wallet|billetera/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('more page has send, receive, history, and grants links', async ({ page }) => {
    await page.goto('/more');

    await expect(page.getByRole('link', { name: /send|enviar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /receive|recibir/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /history|historial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /grants|subvenciones/i })).toBeVisible();
  });

  test('navigating to unknown route shows 404 page', async ({ page }) => {
    await page.goto('/nonexistent');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.getByRole('link', { name: /go home|ir al inicio/i })).toBeVisible();
  });

  test('language toggle switches between EN and ES', async ({ page }) => {
    await page.goto('/');

    // The language button shows exactly "ES" or "EN" (2 chars)
    // Use exact text match to avoid matching "VES" currency button
    const langButton = page.getByRole('button', { name: /^(ES|EN)$/ });
    const initialText = await langButton.textContent();

    await langButton.click();

    // Language should have toggled
    const newText = await langButton.textContent();
    expect(newText).not.toBe(initialText);
  });
});
