import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Social Payments — Send to @username', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth so isAuthenticated = true
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          wallet: 'MockWallet1234',
          email: null,
          displayName: 'Test User',
          username: 'testuser',
          citizenNumber: 1,
        }),
      })
    );
    await page.route('**/api/auth/nonce', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ nonce: 'mock-nonce-12345' }),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate to send via wallet page action button
    await page
      .getByRole('link', { name: /send|enviar/i })
      .first()
      .click();
    await expect(page).toHaveURL('/send');
  });

  test('send page shows username/address input placeholder', async ({ page }) => {
    // Default locale is ES: "@username, #ciudadano, o dirección Solana"
    const input = page.getByPlaceholder(/@username|#citizen|#ciudadano|solana/i).first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('typing @username shows resolving spinner', async ({ page }) => {
    // Mock the lookup endpoint with a delay to catch the spinner
    await page.route('**/api/social/lookup*', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          walletAddress: '11111111111111111111111111111112',
          displayName: 'Juan',
          username: 'juan',
          citizenNumber: 42,
        }),
      });
    });

    const input = page.getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i).first();
    await input.fill('@juan');

    // Resolving spinner should appear
    await expect(page.getByText(/resolving|resolviendo/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('resolving @username shows user card', async ({ page }) => {
    await page.route('**/api/social/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          walletAddress: '11111111111111111111111111111112',
          displayName: 'Juan Rosales',
          username: 'juan',
          citizenNumber: 42,
        }),
      })
    );

    const input = page.getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i).first();
    await input.fill('@juan');

    // Wait for resolved card to appear
    await expect(page.getByText('Juan Rosales').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/1111.*1112/i).first()).toBeVisible();
  });

  test('resolving #citizen shows user card', async ({ page }) => {
    await page.route('**/api/social/lookup*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          walletAddress: '11111111111111111111111111111112',
          displayName: 'Maria',
          username: 'maria',
          citizenNumber: 42,
        }),
      })
    );

    const input = page.getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i).first();
    await input.fill('#42');

    // Wait for resolved card to appear
    await expect(page.getByText('Maria').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows error for unknown username', async ({ page }) => {
    await page.route('**/api/social/lookup*', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'User not found' }),
      })
    );

    const input = page.getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i).first();
    await input.fill('@nonexistent');

    // Error message should appear
    await expect(page.getByText(/not found|no encontrad/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('short username shows validation error', async ({ page }) => {
    const input = page.getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i).first();
    await input.fill('@ab');

    await expect(page.getByText(/at least 3|al menos 3/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Social Payments — Contacts Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          wallet: 'MockWallet1234',
          email: null,
          displayName: null,
          username: null,
          citizenNumber: 1,
        }),
      })
    );
    await page.route('**/api/auth/nonce', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ nonce: 'mock-nonce-12345' }),
      })
    );

    // Mock contacts sync
    await page.route('**/api/social/contacts', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ synced: 0 }),
        });
      }
      // GET — return mock contacts with resolved profiles
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'c1',
            contactAddress: '11111111111111111111111111111112',
            label: 'Mamá',
            isFavorite: true,
            displayName: 'María García',
            username: 'mama',
            citizenNumber: 5,
          },
          {
            id: 'c2',
            contactAddress: '22222222222222222222222222222222',
            label: 'Exchange',
            isFavorite: false,
            displayName: null,
            username: null,
            citizenNumber: null,
          },
        ]),
      });
    });

    await createWalletAndUnlock(page);

    // Navigate to contacts
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /contacts|contactos/i })
      .first()
      .click();
    await expect(page).toHaveURL('/contacts');
  });

  test('contacts page loads with title', async ({ page }) => {
    await expect(page.getByText(/contacts|contactos/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows add contact button', async ({ page }) => {
    await expect(page.getByText(/add contact|agregar contacto/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('add contact form toggles open', async ({ page }) => {
    await page
      .getByText(/add contact|agregar contacto/i)
      .first()
      .click();

    // Form inputs should appear
    await expect(page.getByPlaceholder(/mom|mamá|exchange|amigo/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByPlaceholder(/solana address|dirección de solana/i).first()
    ).toBeVisible();
  });

  test('validates empty name', async ({ page }) => {
    await page
      .getByText(/add contact|agregar contacto/i)
      .first()
      .click();

    const addressInput = page.getByPlaceholder(/solana address|dirección de solana/i).first();
    await addressInput.fill('11111111111111111111111111111112');

    await page
      .getByRole('button', { name: /save|guardar/i })
      .first()
      .click();

    // Should show name required error
    await expect(page.getByText(/name.*required|nombre.*requerido/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('validates invalid address', async ({ page }) => {
    await page
      .getByText(/add contact|agregar contacto/i)
      .first()
      .click();

    const nameInput = page.getByPlaceholder(/mom|mamá|exchange|amigo/i).first();
    await nameInput.fill('Test Contact');

    const addressInput = page.getByPlaceholder(/solana address|dirección de solana/i).first();
    await addressInput.fill('not-a-valid-address');

    await page
      .getByRole('button', { name: /save|guardar/i })
      .first()
      .click();

    // Should show invalid address error
    await expect(page.getByText(/invalid.*address|dirección.*inválida/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows empty state when no contacts', async ({ page }) => {
    // Fresh wallet has no local contacts
    await expect(page.getByText(/no contacts|sin contactos/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
