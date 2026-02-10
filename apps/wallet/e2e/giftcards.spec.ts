import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_PRODUCTS = [
  {
    id: 'amazon-us',
    name: 'Amazon US',
    category: 'shopping',
    denominations: [10, 25, 50, 100],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'entertainment',
    denominations: [15, 30, 60],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'steam',
    name: 'Steam',
    category: 'gaming',
    denominations: [20, 50],
    currency: 'USD',
    country: 'US',
  },
  {
    id: 'uber-eats',
    name: 'Uber Eats',
    category: 'food',
    denominations: [15, 25],
    currency: 'USD',
    country: 'US',
  },
];

const MOCK_HISTORY = [
  {
    id: 'gc-1',
    productName: 'Amazon US $25',
    amountUsd: 25,
    code: 'ABCD-EFGH-IJKL',
    pin: null,
    status: 'DELIVERED',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'gc-2',
    productName: 'Netflix $15',
    amountUsd: 15,
    code: null,
    pin: null,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  },
];

test.describe('Gift Cards Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API routes BEFORE wallet creation
    await page.route('**/api/giftcard/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          treasuryWallet: '11111111111111111111111111111111',
          categories: ['shopping', 'entertainment', 'gaming', 'food'],
          usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        }),
      })
    );

    await page.route('**/api/giftcard/products', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS),
      })
    );

    await page.route('**/api/giftcard/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_HISTORY),
      })
    );

    await createWalletAndUnlock(page);

    // Navigate to gift cards via More menu
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await expect(page).toHaveURL('/more');
    await page
      .getByRole('link', { name: /gift cards|tarjetas de regalo/i })
      .first()
      .click();
    await expect(page).toHaveURL('/giftcards');
  });

  test('page loads with title and subtitle', async ({ page }) => {
    await expect(page.getByText(/gift cards|tarjetas de regalo/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/buy gift cards|compra tarjetas/i).first()).toBeVisible();
  });

  test('browse and history tabs are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /browse|explorar/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /history|historial/i })).toBeVisible();
  });

  test('category filter chips are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^all$|^todos$/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /shopping|compras/i }).first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /entertainment|entretenimiento/i }).first()
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /gaming|juegos/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /food|comida/i }).first()).toBeVisible();
  });

  test('product grid shows all products', async ({ page }) => {
    await expect(page.getByText('Amazon US').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Netflix').first()).toBeVisible();
    await expect(page.getByText('Steam').first()).toBeVisible();
    await expect(page.getByText('Uber Eats').first()).toBeVisible();
  });

  test('category filter narrows products', async ({ page }) => {
    await expect(page.getByText('Amazon US').first()).toBeVisible({ timeout: 10000 });

    // Click "Gaming" filter
    await page
      .getByRole('button', { name: /gaming|juegos/i })
      .first()
      .click();

    // Steam should be visible, Amazon and Netflix product cards should not
    await expect(page.getByText('Steam').first()).toBeVisible();
    // Product cards have the product name as a <p> inside a button.card
    // "Netflix" also appears in the subtitle, so check the product card button specifically
    await expect(page.locator('button.card', { hasText: 'Amazon US' })).not.toBeVisible();
    await expect(page.locator('button.card', { hasText: 'Netflix' })).not.toBeVisible();
  });

  test('selecting product shows amount selector', async ({ page }) => {
    await expect(page.getByText('Amazon US').first()).toBeVisible({ timeout: 10000 });

    // Click Amazon product card
    await page.getByText('Amazon US').first().click();

    // Amount selector should appear with denomination buttons
    await expect(page.getByText(/select amount|selecciona el monto/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('button', { name: '$10', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$25', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$50', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '$100', exact: true })).toBeVisible();
  });

  test('buy button is disabled until amount is selected', async ({ page }) => {
    await expect(page.getByText('Amazon US').first()).toBeVisible({ timeout: 10000 });
    await page.getByText('Amazon US').first().click();

    // Buy button should be disabled initially
    const buyBtn = page.getByRole('button', { name: /buy|comprar/i }).first();
    await expect(buyBtn).toBeVisible({ timeout: 5000 });
    await expect(buyBtn).toBeDisabled();

    // Select an amount
    await page.getByRole('button', { name: '$25', exact: true }).click();

    // Buy button should now be enabled
    await expect(buyBtn).toBeEnabled();
  });

  test('deselecting product hides amount selector', async ({ page }) => {
    await expect(page.getByText('Amazon US').first()).toBeVisible({ timeout: 10000 });

    // Select then deselect
    await page.getByText('Amazon US').first().click();
    await expect(page.getByText(/select amount|selecciona el monto/i).first()).toBeVisible({
      timeout: 5000,
    });
    await page.getByText('Amazon US').first().click();

    // Amount selector should disappear
    await expect(page.getByText(/select amount|selecciona el monto/i)).not.toBeVisible();
  });

  test('history tab shows purchase records', async ({ page }) => {
    await expect(page.getByRole('button', { name: /history|historial/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /history|historial/i }).click();

    // Should show the mock history items
    await expect(page.getByText('Amazon US $25').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('$25').first()).toBeVisible();
    await expect(page.getByText(/delivered|entregado/i).first()).toBeVisible();

    // Pending item
    await expect(page.getByText('Netflix $15').first()).toBeVisible();
    await expect(page.getByText(/pending|pendiente/i).first()).toBeVisible();
  });

  test('history tab shows gift card code with copy button', async ({ page }) => {
    await page.getByRole('button', { name: /history|historial/i }).click();

    // Delivered item should show code
    await expect(page.getByText('ABCD-EFGH-IJKL')).toBeVisible({ timeout: 10000 });

    // Copy button should be visible
    const copyBtn = page.getByRole('button', { name: /copy|copiar/i }).first();
    await expect(copyBtn).toBeVisible();
  });

  test('powered by Bitrefill footer is visible', async ({ page }) => {
    await expect(page.getByText(/powered by bitrefill/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Gift Cards Page — disabled state', () => {
  test('shows unavailable banner when disabled', async ({ page }) => {
    await page.route('**/api/giftcard/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false }),
      })
    );

    await page.route('**/api/giftcard/products', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /gift cards|tarjetas de regalo/i })
      .first()
      .click();
    await expect(page).toHaveURL('/giftcards');

    await expect(page.getByText(/not available|no disponible/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Gift Cards Page — empty history', () => {
  test('history tab shows empty state', async ({ page }) => {
    await page.route('**/api/giftcard/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          treasuryWallet: '11111111111111111111111111111111',
          categories: ['shopping', 'entertainment', 'gaming', 'food'],
        }),
      })
    );

    await page.route('**/api/giftcard/products', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS),
      })
    );

    await page.route('**/api/giftcard/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);

    const nav = page.locator('nav[aria-label="Main navigation"]');
    await nav.getByRole('link', { name: /more|más/i }).click();
    await page
      .getByRole('link', { name: /gift cards|tarjetas de regalo/i })
      .first()
      .click();

    await page.getByRole('button', { name: /history|historial/i }).click();

    await expect(page.getByText(/no gift card|sin compras/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
