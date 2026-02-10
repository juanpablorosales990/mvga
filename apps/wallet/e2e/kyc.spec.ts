import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('KYC Page — unverified', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/kyc/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UNVERIFIED', rejectionReason: null }),
      })
    );

    await createWalletAndUnlock(page);

    // SPA navigation — click a link that navigates to /kyc
    await page.evaluate(() => window.history.pushState({}, '', '/kyc'));
    await page.reload();
    // Unlock after reload
    const passwordInput = page.getByPlaceholder(/enter password|ingresa tu contraseña/i);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('Str0ng!Pass99');
      await page.getByRole('button', { name: /unlock|desbloquear/i }).click();
    }
    await expect(page).toHaveURL('/kyc');
  });

  test('page loads with title', async ({ page }) => {
    await expect(page.getByText(/verify your identity|verificar.*identidad/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('unverified state shows start button', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /start verification|iniciar verificación/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('back link is visible', async ({ page }) => {
    await expect(page.getByText(/back|atrás|volver/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('KYC Page — pending status', () => {
  test('shows pending state', async ({ page }) => {
    await page.route('**/api/kyc/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'PENDING', rejectionReason: null }),
      })
    );

    await createWalletAndUnlock(page);
    await page.evaluate(() => window.history.pushState({}, '', '/kyc'));
    await page.reload();
    const passwordInput = page.getByPlaceholder(/enter password|ingresa tu contraseña/i);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('Str0ng!Pass99');
      await page.getByRole('button', { name: /unlock|desbloquear/i }).click();
    }

    await expect(page.getByText(/in progress|pendiente|review/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('KYC Page — approved status', () => {
  test('shows approved state', async ({ page }) => {
    await page.route('**/api/kyc/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'APPROVED', rejectionReason: null }),
      })
    );

    await createWalletAndUnlock(page);
    await page.evaluate(() => window.history.pushState({}, '', '/kyc'));
    await page.reload();
    const passwordInput = page.getByPlaceholder(/enter password|ingresa tu contraseña/i);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('Str0ng!Pass99');
      await page.getByRole('button', { name: /unlock|desbloquear/i }).click();
    }

    await expect(page.getByText(/verified|aprobad/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('KYC Page — rejected status', () => {
  test('shows rejected state with reason and retry button', async ({ page }) => {
    await page.route('**/api/kyc/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason: 'Document is unreadable',
        }),
      })
    );

    await createWalletAndUnlock(page);
    await page.evaluate(() => window.history.pushState({}, '', '/kyc'));
    await page.reload();
    const passwordInput = page.getByPlaceholder(/enter password|ingresa tu contraseña/i);
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('Str0ng!Pass99');
      await page.getByRole('button', { name: /unlock|desbloquear/i }).click();
    }

    await expect(page.getByText(/failed|rechazad/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/document is unreadable/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /try again|intentar de nuevo/i })).toBeVisible();
  });
});
