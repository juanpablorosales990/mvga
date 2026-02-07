import { test, expect } from '@playwright/test';

// With self-custody wallet, when no wallet exists, all routes show onboarding screen.
// These tests verify that behavior.

test.describe('Pages without wallet', () => {
  test('stake page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/stake');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('swap page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/swap');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('history page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/history');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('send page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('receive page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/receive');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('create proposal page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/grants/create');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('trade page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/p2p/trade/invalid-id-123');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('grant detail page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/grants/nonexistent-id');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });

  test('more page shows onboarding when not connected', async ({ page }) => {
    await page.goto('/more');
    await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible();
  });
});
