import { test, expect } from '@playwright/test';

test.describe('Stake Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/stake');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('Swap Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/swap');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('History Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('Send Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('Receive Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/receive');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('Create Proposal Page', () => {
  test('shows connect prompt when not connected', async ({ page }) => {
    await page.goto('/grants/create');
    await expect(page.locator('text=/connect.*wallet|conecta.*billetera/i')).toBeVisible();
  });
});

test.describe('Trade Page', () => {
  test('shows error or connect prompt for invalid trade ID', async ({ page }) => {
    await page.goto('/p2p/trade/invalid-id-123');
    // Should show either "Trade not found", connect prompt, or error state
    await expect(
      page.locator('text=/not found|connect.*wallet|conecta.*billetera|error/i')
    ).toBeVisible();
  });
});

test.describe('Grant Detail Page', () => {
  test('shows not found for nonexistent grant', async ({ page }) => {
    await page.goto('/grants/nonexistent-id');
    // Should show "Proposal not found" or loading/error state
    await expect(page.locator('text=/not found|no encontrada|loading|cargando/i')).toBeVisible();
  });

  test('has back to grants link', async ({ page }) => {
    await page.goto('/grants/nonexistent-id');
    await expect(page.locator('text=/back.*grants|volver.*subvenciones/i')).toBeVisible();
  });
});

test.describe('More Page', () => {
  test('renders all menu items without wallet connection', async ({ page }) => {
    await page.goto('/more');

    await expect(page.locator('text=/more|mas/i').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /send|enviar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /receive|recibir/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /history|historial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /grants|subvenciones/i })).toBeVisible();
  });

  test('send link navigates to /send', async ({ page }) => {
    await page.goto('/more');
    await page.getByRole('link', { name: /send|enviar/i }).click();
    await expect(page).toHaveURL('/send');
  });

  test('grants link navigates to /grants', async ({ page }) => {
    await page.goto('/more');
    await page.getByRole('link', { name: /grants|subvenciones/i }).click();
    await expect(page).toHaveURL('/grants');
  });
});
