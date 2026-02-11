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

test.describe('Social Payments — Request Page', () => {
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

    // Navigate via More → Request Money
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /solicitar dinero|request money/i })
      .first()
      .click();
    await expect(page).toHaveURL('/request');
  });

  test('request page loads with title', async ({ page }) => {
    await expect(page.getByText(/solicitar dinero|request money/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows submit button disabled when fields empty', async ({ page }) => {
    const button = page.getByRole('button', { name: /enviar solicitud|send request/i });
    await expect(button).toBeVisible({ timeout: 10000 });
    await expect(button).toBeDisabled();
  });

  test('shows token selector with USDC default', async ({ page }) => {
    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 10000 });
    await expect(select).toHaveValue('USDC');
  });

  test('shows note input placeholder', async ({ page }) => {
    const noteInput = page.getByPlaceholder(/arepas/i).first();
    await expect(noteInput).toBeVisible({ timeout: 10000 });
  });

  test('submits request successfully', async ({ page }) => {
    // Mock lookup + request endpoint
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
    await page.route('**/api/payments/request-from-user', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'req-1', status: 'PENDING' }),
      })
    );
    // Mock inbox endpoints for navigation target
    await page.route('**/api/payments/requests-for-me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/payments/my-requests', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    // Fill recipient
    const recipientInput = page
      .getByPlaceholder(/@username|@usuario|#citizen|#ciudadano|solana/i)
      .first();
    await recipientInput.fill('@maria');
    await expect(page.getByText('Maria').first()).toBeVisible({ timeout: 5000 });

    // Fill amount
    const amountInput = page.getByPlaceholder('0.00');
    await amountInput.fill('10');

    // Fill note
    const noteInput = page.getByPlaceholder(/arepas/i).first();
    await noteInput.fill('for arepas');

    // Submit
    const button = page.getByRole('button', { name: /enviar solicitud|send request/i });
    await expect(button).toBeEnabled();
    await button.click();

    // Should navigate to /requests
    await expect(page).toHaveURL('/requests', { timeout: 10000 });
  });

  test('shows link to inbox', async ({ page }) => {
    const link = page.getByText(/solicitudes|inbox/i).first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Social Payments — Requests Inbox', () => {
  const mockIncoming = [
    {
      id: 'req-in-1',
      recipientAddress: 'RequesterWallet111111111111111111111111111',
      token: 'USDC',
      amount: 10,
      amountRaw: '10000000',
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      requesterId: 'user-2',
      requesterUsername: 'juan',
      requesteeAddress: 'MockWallet1234',
      note: 'for arepas',
      declinedAt: null,
    },
  ];

  const mockOutgoing = [
    {
      id: 'req-out-1',
      recipientAddress: 'MockWallet1234',
      token: 'USDC',
      amount: 5,
      amountRaw: '5000000',
      memo: null,
      status: 'PENDING',
      paymentTx: null,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      requesterId: 'user-1',
      requesterUsername: 'testuser',
      requesteeAddress: 'OtherWallet111111111111111111111111111111',
      note: 'dinner',
      declinedAt: null,
    },
  ];

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
    await page.route('**/api/payments/requests-for-me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIncoming),
      })
    );
    await page.route('**/api/payments/my-requests', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOutgoing),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate via More → Requests Inbox
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /buzón de solicitudes|requests inbox/i })
      .first()
      .click();
    await expect(page).toHaveURL('/requests');
  });

  test('inbox page loads with title', async ({ page }) => {
    await expect(page.getByText(/solicitudes|requests/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows incoming and outgoing tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /recibidas|incoming/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /enviadas|outgoing/i })).toBeVisible();
  });

  test('incoming tab shows request with username and note', async ({ page }) => {
    // Default tab is incoming
    await expect(page.getByText('@juan').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('for arepas').first()).toBeVisible();
    await expect(page.getByText('$10.00').first()).toBeVisible();
  });

  test('incoming request shows pay and decline buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /pagar|pay/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /rechazar|decline/i }).first()).toBeVisible();
  });

  test('pay button navigates to send page with params', async ({ page }) => {
    // Mock send page dependencies
    await page.route('**/api/wallet/balances', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    const payButton = page.getByRole('button', { name: /pagar|pay/i }).first();
    await expect(payButton).toBeVisible({ timeout: 10000 });
    await payButton.click();

    // Should navigate to send page with query params
    await expect(page).toHaveURL(/\/send\?.*requestId=req-in-1/i, { timeout: 10000 });
  });

  test('outgoing tab shows sent requests', async ({ page }) => {
    const outgoingTab = page.getByRole('button', { name: /enviadas|outgoing/i });
    await expect(outgoingTab).toBeVisible({ timeout: 10000 });
    await outgoingTab.click();

    // Should show outgoing request
    await expect(page.getByText('$5.00').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('dinner').first()).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();
  });

  test('shows new request link', async ({ page }) => {
    const link = page.getByText(/nueva solicitud|new request/i).first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Social Payments — SendPage Request Integration', () => {
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
  });

  test('shows note input on send page', async ({ page }) => {
    // Navigate to send via nav link
    await page
      .getByRole('link', { name: /send|enviar/i })
      .first()
      .click();
    await expect(page).toHaveURL('/send');

    const noteInput = page.getByPlaceholder(/arepas|nota/i).first();
    await expect(noteInput).toBeVisible({ timeout: 10000 });
  });

  test('pay from inbox pre-fills send page with request params', async ({ page }) => {
    // Mock inbox endpoints
    const mockIncoming = [
      {
        id: 'req-pay-1',
        recipientAddress: 'RequesterAddr1111111111111111111111111111',
        token: 'USDC',
        amount: 25,
        amountRaw: '25000000',
        memo: null,
        status: 'PENDING',
        paymentTx: null,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        requesterId: 'user-2',
        requesterUsername: 'maria',
        requesteeAddress: 'MockWallet1234',
        note: 'groceries',
        declinedAt: null,
      },
    ];
    await page.route('**/api/payments/requests-for-me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIncoming),
      })
    );
    await page.route('**/api/payments/my-requests', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.route('**/api/wallet/balances', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    // Navigate to inbox
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /buzón de solicitudes|requests inbox/i })
      .first()
      .click();
    await expect(page).toHaveURL('/requests');

    // Click Pay on the incoming request
    const payButton = page.getByRole('button', { name: /pagar|pay/i }).first();
    await expect(payButton).toBeVisible({ timeout: 10000 });
    await payButton.click();

    // Should navigate to send page with params
    await expect(page).toHaveURL(/\/send\?.*requestId=req-pay-1/i, { timeout: 10000 });

    // Amount should be pre-filled
    const amountInput = page.getByPlaceholder('0.00').first();
    await expect(amountInput).toBeVisible({ timeout: 10000 });
    await expect(amountInput).toHaveValue('25');

    // Request context banner should be visible
    await expect(page.getByText(/pagando.*solicitud|paying.*request/i).first()).toBeVisible();
  });
});
