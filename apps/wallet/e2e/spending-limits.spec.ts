import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Spending Limits Page', () => {
  test.beforeEach(async ({ page }) => {
    await createWalletAndUnlock(page);

    // Navigate via More → Spending Limits
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /spending limits|límites de gasto/i })
      .first()
      .click();
    await expect(page).toHaveURL('/spending-limits');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/spending limits|límites de gasto/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows empty state when no limits', async ({ page }) => {
    await expect(page.getByText(/no spending limits|sin límites de gasto/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows add limit button', async ({ page }) => {
    await expect(page.getByText(/add limit|agregar límite/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('toggles create form on add limit click', async ({ page }) => {
    // Click "Add Limit"
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    // Form should be visible with period selector
    await expect(page.getByText(/^period$|^período$/i).first()).toBeVisible({ timeout: 5000 });

    // Amount input
    await expect(page.getByPlaceholder('0.00').first()).toBeVisible();

    // Token selector
    await expect(page.getByText(/^token$/i).first()).toBeVisible();

    // Create button
    await expect(page.getByRole('button', { name: /create limit|crear límite/i })).toBeVisible();
  });

  test('create form hides on cancel', async ({ page }) => {
    // Open form
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    await expect(page.getByPlaceholder('0.00').first()).toBeVisible({ timeout: 5000 });

    // Click cancel (same button toggles)
    await page
      .getByText(/cancel|cancelar/i)
      .first()
      .click();

    // Form should be hidden
    await expect(page.getByPlaceholder('0.00')).not.toBeVisible();
  });

  test('create button disabled without amount', async ({ page }) => {
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    const createBtn = page.getByRole('button', { name: /create limit|crear límite/i });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await expect(createBtn).toBeDisabled();
  });

  test('creates a daily spending limit', async ({ page }) => {
    // Open form
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    // Period should default to daily
    const periodSelect = page.locator('select').first();
    await expect(periodSelect).toBeVisible({ timeout: 5000 });

    // Fill amount
    await page.getByPlaceholder('0.00').first().fill('100');

    // Click create
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    // Form should close
    await expect(page.getByPlaceholder('0.00')).not.toBeVisible({ timeout: 5000 });

    // Empty state should be gone
    await expect(page.getByText(/no spending limits|sin límites de gasto/i)).not.toBeVisible();

    // Should show the limit card with daily + limit text
    await expect(page.getByText(/daily|diario/i).first()).toBeVisible({ timeout: 5000 });

    // Should show $0.00 / $100.00
    await expect(page.getByText('$0.00 / $100.00').first()).toBeVisible();

    // Active badge should be visible
    await expect(page.getByText(/^active$|^activo$/i).first()).toBeVisible();

    // 0% progress
    await expect(page.getByText('0%').first()).toBeVisible();
  });

  test('creates a weekly limit with specific token', async ({ page }) => {
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    // Select weekly period
    const periodSelect = page.locator('select').first();
    await periodSelect.selectOption('weekly');

    // Fill amount
    await page.getByPlaceholder('0.00').first().fill('500');

    // Select USDC token
    const tokenSelect = page.locator('select').nth(1);
    await tokenSelect.selectOption('USDC');

    // Create
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    // Should show weekly limit card
    await expect(page.getByText(/weekly|semanal/i).first()).toBeVisible({ timeout: 5000 });

    // Should show USDC badge
    await expect(page.getByText('USDC').first()).toBeVisible();

    // Should show $0.00 / $500.00
    await expect(page.getByText('$0.00 / $500.00').first()).toBeVisible();
  });

  test('creates a monthly limit', async ({ page }) => {
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    const periodSelect = page.locator('select').first();
    await periodSelect.selectOption('monthly');

    await page.getByPlaceholder('0.00').first().fill('2000');

    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    await expect(page.getByText(/monthly|mensual/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('$0.00 / $2000.00').first()).toBeVisible();
  });

  test('toggle limit pauses and resumes', async ({ page }) => {
    // Create a limit first
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    await page.getByPlaceholder('0.00').first().fill('100');
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    // Should show Active
    const activeBtn = page.getByText(/^active$|^activo$/i).first();
    await expect(activeBtn).toBeVisible({ timeout: 5000 });

    // Click to pause
    await activeBtn.click();

    // Should now show Paused
    await expect(page.getByText(/^paused$|^pausado$/i).first()).toBeVisible({ timeout: 5000 });

    // Card should have reduced opacity (not directly testable, but we can verify state)
    // Click to resume
    await page
      .getByText(/^paused$|^pausado$/i)
      .first()
      .click();
    await expect(page.getByText(/^active$|^activo$/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('remove limit deletes it', async ({ page }) => {
    // Create a limit
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    await page.getByPlaceholder('0.00').first().fill('100');
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    // Verify limit exists
    await expect(page.getByText('$0.00 / $100.00').first()).toBeVisible({ timeout: 5000 });

    // Click remove
    await page
      .getByText(/^remove$|^eliminar$/i)
      .first()
      .click();

    // Should be back to empty state
    await expect(page.getByText(/no spending limits|sin límites de gasto/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('creates multiple limits', async ({ page }) => {
    // Create daily limit
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    await page.getByPlaceholder('0.00').first().fill('50');
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();
    await expect(page.getByText('$0.00 / $50.00').first()).toBeVisible({ timeout: 5000 });

    // Create weekly limit
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();
    const periodSelect = page.locator('select').first();
    await periodSelect.selectOption('weekly');
    await page.getByPlaceholder('0.00').first().fill('200');
    await page.getByRole('button', { name: /create limit|crear límite/i }).click();

    // Both should be visible
    await expect(page.getByText('$0.00 / $50.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('$0.00 / $200.00').first()).toBeVisible();
  });

  test('period selector has all three options', async ({ page }) => {
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    const periodSelect = page.locator('select').first();
    await expect(periodSelect).toBeVisible({ timeout: 5000 });

    // Check all options exist
    const options = periodSelect.locator('option');
    await expect(options).toHaveCount(3);
  });

  test('token selector has ALL, USDC, SOL, MVGA', async ({ page }) => {
    await page
      .getByText(/add limit|agregar límite/i)
      .first()
      .click();

    const tokenSelect = page.locator('select').nth(1);
    await expect(tokenSelect).toBeVisible({ timeout: 5000 });

    const options = tokenSelect.locator('option');
    await expect(options).toHaveCount(4);
  });
});
