import { test, expect } from '@playwright/test';
import { createWalletAndUnlock } from './helpers';

const MOCK_ON_RAMP_OFFERS = [
  {
    id: 'offer-1',
    lpWalletAddress: 'LPAddr1111111111111111111111111111111111111',
    availableUsdc: 500,
    vesRate: 42.5,
    feePercent: 1.5,
    effectiveRate: 43.14,
    minOrderUsdc: 5,
    maxOrderUsdc: 200,
    bankCode: '0105',
    bankName: 'Banco Mercantil',
    phoneNumber: '04161234567',
    ciNumber: 'V12345678',
    status: 'ACTIVE',
    totalOrders: 10,
    completedOrders: 8,
    direction: 'ON_RAMP',
    lpRating: 4.8,
    lpCompletedTrades: 50,
    createdAt: new Date().toISOString(),
  },
];

const MOCK_OFF_RAMP_OFFERS = [
  {
    id: 'offer-2',
    lpWalletAddress: 'LPAddr2222222222222222222222222222222222222',
    availableUsdc: 300,
    vesRate: 41.0,
    feePercent: 2.0,
    effectiveRate: 41.82,
    minOrderUsdc: 10,
    maxOrderUsdc: 150,
    bankCode: '0134',
    bankName: 'Banesco',
    phoneNumber: '04249876543',
    ciNumber: 'V87654321',
    status: 'ACTIVE',
    totalOrders: 5,
    completedOrders: 4,
    direction: 'OFF_RAMP',
    lpRating: 4.5,
    lpCompletedTrades: 20,
    createdAt: new Date().toISOString(),
  },
];

const MOCK_ORDERS = [
  {
    id: 'order-1',
    offerId: 'offer-1',
    buyerWalletAddress: 'BuyerAddr111111111111111111111111111111111',
    lpWalletAddress: 'LPAddr1111111111111111111111111111111111111',
    amountUsdc: 50,
    amountVes: 2157,
    vesRate: 42.5,
    feePercent: 1.5,
    status: 'COMPLETED',
    escrowTx: 'tx123',
    releaseTx: 'tx456',
    disputeReason: null,
    direction: 'ON_RAMP',
    pagoMovil: {
      bankCode: '0105',
      bankName: 'Banco Mercantil',
      phoneNumber: '04161234567',
      ciNumber: 'V12345678',
    },
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  },
  {
    id: 'order-2',
    offerId: 'offer-2',
    buyerWalletAddress: 'SellerAddr1111111111111111111111111111111',
    lpWalletAddress: 'LPAddr2222222222222222222222222222222222222',
    amountUsdc: 30,
    amountVes: 1254.6,
    vesRate: 41.0,
    feePercent: 2.0,
    status: 'ESCROW_LOCKED',
    escrowTx: 'tx789',
    releaseTx: null,
    disputeReason: null,
    direction: 'OFF_RAMP',
    pagoMovil: {
      bankCode: '0134',
      bankName: 'Banesco',
      phoneNumber: '04249876543',
      ciNumber: 'V87654321',
    },
    createdAt: new Date().toISOString(),
    paidAt: null,
    completedAt: null,
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  },
];

async function navigateToVesOnramp(page: import('@playwright/test').Page) {
  const nav = page.locator('nav[aria-label="Main navigation"]');
  await nav.getByRole('link', { name: /more|más/i }).click();
  await expect(page).toHaveURL('/more');
  await page
    .getByRole('link', { name: /bolivar|bolívar|cambio/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/ves-onramp/);
}

test.describe('VES Exchange — Buy Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ves-onramp/offers?direction=ON_RAMP', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ON_RAMP_OFFERS),
      })
    );
    await page.route('**/api/ves-onramp/offers?direction=OFF_RAMP', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OFF_RAMP_OFFERS),
      })
    );
    await page.route('**/api/ves-onramp/orders', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ORDERS),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS[0]),
      });
    });

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);
  });

  test('page loads with 4 tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: /buy|comprar/i }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /sell|vender/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /orders|órdenes/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /provide liquidity|proveer liquidez/i })
    ).toBeVisible();
  });

  test('Buy tab shows ON_RAMP offers', async ({ page }) => {
    await expect(page.getByText('Banco Mercantil').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/43\.14/i).first()).toBeVisible();
    await expect(page.getByText('$500').first()).toBeVisible();
  });

  test('clicking an offer expands amount input', async ({ page }) => {
    await page.getByText('Banco Mercantil').first().click();
    await expect(page.getByPlaceholder(/VES/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('VES Exchange — Sell Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ves-onramp/offers?direction=ON_RAMP', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ON_RAMP_OFFERS),
      })
    );
    await page.route('**/api/ves-onramp/offers?direction=OFF_RAMP', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OFF_RAMP_OFFERS),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);
  });

  test('Sell tab loads OFF_RAMP offers', async ({ page }) => {
    await page
      .getByRole('button', { name: /sell|vender/i })
      .first()
      .click();
    await expect(page.getByText('Banesco').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/41\.82/i).first()).toBeVisible();
    await expect(page.getByText('$300').first()).toBeVisible();
  });

  test('Sell tab shows bank details form when offer expanded', async ({ page }) => {
    await page
      .getByRole('button', { name: /sell|vender/i })
      .first()
      .click();
    await page.getByText('Banesco').first().click();
    await expect(page.getByPlaceholder(/USDC/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('0105').first()).toBeVisible();
    await expect(page.getByPlaceholder('V12345678').first()).toBeVisible();
  });

  test('Sell button is disabled without bank details', async ({ page }) => {
    await page
      .getByRole('button', { name: /sell|vender/i })
      .first()
      .click();
    await page.getByText('Banesco').first().click();

    // Enter amount but no bank details
    await page.getByPlaceholder(/USDC/i).first().fill('50');

    // The submit button is the second "Sell USDC" button (first is the tab)
    const sellBtn = page.locator('button.btn-primary', { hasText: /sell usdc|vender usdc/i });
    await expect(sellBtn).toBeVisible({ timeout: 10000 });
    await expect(sellBtn).toBeDisabled();
  });
});

test.describe('VES Exchange — Orders Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ves-onramp/offers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );
    await page.route('**/api/ves-onramp/orders', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);
  });

  test('Orders tab shows direction badges', async ({ page }) => {
    await page.getByRole('button', { name: /orders|órdenes/i }).click();

    // ON_RAMP order shows "Buy" badge
    await expect(page.getByText(/buy|compra/i).first()).toBeVisible({ timeout: 10000 });
    // OFF_RAMP order shows "Sell" badge
    await expect(page.getByText(/sell|vend/i).first()).toBeVisible();
  });

  test('Orders tab shows direction-aware amounts', async ({ page }) => {
    await page.getByRole('button', { name: /orders|órdenes/i }).click();

    // ON_RAMP: VES → USDC
    await expect(page.getByText(/2,157.*\$50/i).first()).toBeVisible({ timeout: 10000 });
    // OFF_RAMP: USDC → VES
    await expect(page.getByText(/\$30.*1,254/i).first()).toBeVisible();
  });
});

test.describe('VES Exchange — LP Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ves-onramp/offers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);
  });

  test('LP tab has direction toggle', async ({ page }) => {
    await page.getByRole('button', { name: /provide liquidity|proveer liquidez/i }).click();

    await expect(
      page.getByRole('button', { name: /accept ves.*i have usdc|aceptar ves.*tengo usdc/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('button', { name: /send ves.*i have ves|enviar ves.*tengo ves/i })
    ).toBeVisible();
  });

  test('LP direction toggle changes description', async ({ page }) => {
    await page.getByRole('button', { name: /provide liquidity|proveer liquidez/i }).click();

    // Default is ON_RAMP — check description
    await expect(page.getByText(/stake usdc and earn|deposita usdc y gana/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Switch to OFF_RAMP
    await page.getByRole('button', { name: /send ves.*i have ves|enviar ves.*tengo ves/i }).click();
    await expect(
      page.getByText(/create offers to buy usdc|crea ofertas para comprar usdc/i).first()
    ).toBeVisible();
  });
});

test.describe('VES Exchange — Empty States', () => {
  test('Buy tab shows empty state', async ({ page }) => {
    await page.route('**/api/ves-onramp/offers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);

    await expect(page.getByText(/no.*offers|no hay ofertas/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('Sell tab shows sell-specific empty state', async ({ page }) => {
    await page.route('**/api/ves-onramp/offers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);

    await page
      .getByRole('button', { name: /sell|vender/i })
      .first()
      .click();
    await expect(page.getByText(/no sell offers|no hay ofertas de venta/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('CashOut — VES Off-Ramp Link', () => {
  test('CashOut page shows VES off-ramp link', async ({ page }) => {
    await page.route('**/api/offramp/payouts', (route) =>
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
      .getByRole('link', { name: /cash out|retiro/i })
      .first()
      .click();

    await expect(
      page.getByText(/sell usdc for bolivars|vender usdc por bolívares/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('VES off-ramp link navigates to sell tab', async ({ page }) => {
    await page.route('**/api/offramp/payouts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    );
    await page.route('**/api/ves-onramp/offers**', (route) =>
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
      .getByRole('link', { name: /cash out|retiro/i })
      .first()
      .click();

    await page
      .getByText(/sell usdc for bolivars|vender usdc por bolívares/i)
      .first()
      .click();

    await expect(page).toHaveURL(/ves-onramp.*tab=sell/);
  });
});

// ── Receipt Upload Tests ────────────────────────────────────────

test.describe('VES Exchange — Payment Receipt', () => {
  test('receipt fields exist in order response shape', async ({ page }) => {
    const orderWithReceipt = {
      ...MOCK_ORDERS[0],
      status: 'PAYMENT_SENT',
      paymentReceipt: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      paymentReference: 'REF123456',
      receiptUploadedAt: new Date().toISOString(),
    };

    await page.route('**/api/ves-onramp/offers**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ON_RAMP_OFFERS),
      })
    );
    await page.route('**/api/ves-onramp/orders', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([orderWithReceipt]),
      })
    );

    await createWalletAndUnlock(page);
    await navigateToVesOnramp(page);

    // Navigate to orders tab
    await page
      .getByRole('button', { name: /orders|órdenes/i })
      .first()
      .click();

    // Verify order with receipt is listed (i18n: "Payment Sent" / "Pago Enviado")
    await expect(page.getByText(/payment sent|pago enviado/i).first()).toBeVisible();
  });
});
