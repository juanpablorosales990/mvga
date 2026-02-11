import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

test.describe('Social Payments — Split Page', () => {
  test.beforeEach(async ({ page }) => {
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

    // Navigate via More → Split Payment
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /dividir pago|split payment/i })
      .first()
      .click();
    await expect(page).toHaveURL('/split');
  });

  test('split page loads with title', async ({ page }) => {
    await expect(page.getByText(/dividir pago|split payment/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows equal and custom toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: /igual|equal/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /personalizado|custom/i })).toBeVisible();
  });

  test('shows token selector with USDC default', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 10000 });
    await expect(select).toHaveValue('USDC');
  });

  test('add participant button works', async ({ page }) => {
    // Start with 1 participant
    const participantLabels = page.getByText(/participante 1|participant 1/i);
    await expect(participantLabels.first()).toBeVisible({ timeout: 10000 });

    // Click add
    await page.getByRole('button', { name: /agregar participante|add participant/i }).click();

    // Now 2 participants
    await expect(page.getByText(/participante 2|participant 2/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('remove participant button works', async ({ page }) => {
    // Add a second participant
    await page.getByRole('button', { name: /agregar participante|add participant/i }).click();
    await expect(page.getByText(/participante 2|participant 2/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Remove button visible
    const removeButtons = page.getByText(/eliminar|remove/i);
    await expect(removeButtons.first()).toBeVisible();
    await removeButtons.first().click();

    // Should be back to 1 participant
    await expect(page.getByText(/participante 2|participant 2/i)).not.toBeVisible();
  });

  test('submits split with mocked API and navigates to detail', async ({ page }) => {
    // Mock lookup + split create
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
    await page.route('**/api/payments/split', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'split-mock-1',
            status: 'PENDING',
            participantCount: 1,
            paidCount: 0,
          }),
        });
      }
      return route.continue();
    });
    // Mock split detail for navigation target
    await page.route('**/api/payments/split/split-mock-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'split-mock-1',
          creatorAddress: 'MockWallet1234',
          totalAmount: 20,
          token: 'USDC',
          description: 'Dinner',
          participantCount: 1,
          status: 'PENDING',
          paidCount: 0,
          totalCollected: 0,
          createdAt: new Date().toISOString(),
          completedAt: null,
          participants: [
            {
              requestId: 'req-1',
              requesteeAddress: '11111111111111111111111111111112',
              amount: 20,
              status: 'PENDING',
              paymentTx: null,
            },
          ],
        }),
      })
    );

    // Fill total amount
    const totalInput = page.getByPlaceholder('0.00').first();
    await totalInput.fill('20');

    // Fill description
    const descInput = page.getByPlaceholder(/dinner|cena|uber|compras/i).first();
    await descInput.fill('Dinner');

    // Fill participant
    const recipientInput = page
      .getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i)
      .first();
    await recipientInput.fill('@maria');
    await expect(page.getByText('Maria').first()).toBeVisible({ timeout: 5000 });

    // Blur total to trigger equal share calc
    await totalInput.click();
    await descInput.click();

    // Submit
    const submitBtn = page.getByRole('button', { name: /dividir y solicitar|split & request/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Should navigate to split detail
    await expect(page).toHaveURL(/\/split\/split-mock-1/, { timeout: 10000 });
  });
});

test.describe('Social Payments — Split Detail Page', () => {
  const mockSplitDetail = {
    id: 'split-mock-1',
    creatorAddress: 'MockWallet1234',
    totalAmount: 50,
    token: 'USDC',
    description: 'Team Lunch',
    participantCount: 2,
    status: 'PARTIAL',
    paidCount: 1,
    totalCollected: 25,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: null,
    participants: [
      {
        requestId: 'req-p1',
        requesteeAddress: 'Friend1111111111111111111111111111111111111',
        amount: 25,
        status: 'PAID',
        paymentTx: 'tx-abc123',
      },
      {
        requestId: 'req-p2',
        requesteeAddress: 'Friend2222222222222222222222222222222222222',
        amount: 25,
        status: 'PENDING',
        paymentTx: null,
      },
    ],
  };

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
    // Mock split detail endpoint
    await page.route('**/api/payments/split/split-mock-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSplitDetail),
      })
    );
    // Mock lookup + split create for the form submission
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
    await page.route('**/api/payments/split', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockSplitDetail),
        });
      }
      return route.continue();
    });

    await createWalletAndUnlock(page);

    // Navigate to split page via SPA
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /dividir pago|split payment/i })
      .first()
      .click();
    await expect(page).toHaveURL('/split');

    // Fill the form and submit to navigate to detail page
    const totalInput = page.getByPlaceholder('0.00').first();
    await totalInput.fill('50');
    const descInput = page.getByPlaceholder(/dinner|cena|uber|compras/i).first();
    await descInput.fill('Team Lunch');
    const recipientInput = page
      .getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i)
      .first();
    await recipientInput.fill('@maria');
    await expect(page.getByText('Maria').first()).toBeVisible({ timeout: 5000 });
    // Trigger equal shares calc
    await totalInput.click();
    await descInput.click();

    const submitBtn = page.getByRole('button', { name: /dividir y solicitar|split & request/i });
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for SPA navigation to detail
    await expect(page).toHaveURL(/\/split\/split-mock-1/, { timeout: 10000 });
  });

  test('detail page shows split description and status', async ({ page }) => {
    await expect(page.getByText('Team Lunch').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('PARTIAL').first()).toBeVisible();
  });

  test('detail page shows progress and participant count', async ({ page }) => {
    // Should show "1 / 2" paid count
    await expect(page.getByText('1 / 2').first()).toBeVisible({ timeout: 10000 });
    // Progress percentage
    await expect(page.getByText(/50%/).first()).toBeVisible();
  });

  test('detail page shows cancel button for partial split', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cancelar split|cancel split/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
