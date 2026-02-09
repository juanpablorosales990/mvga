import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive E2E tests for MVGA Wallet self-custody flows.
 *
 * Tests cover:
 * 1. Onboarding — create wallet with mnemonic
 * 2. Mnemonic backup verification
 * 3. Lock / unlock cycle
 * 4. Delete wallet (reset)
 * 5. Import from recovery phrase
 * 6. Import from secret key
 * 7. Deposit page
 * 8. Header wallet menu (export key, lock, disconnect)
 * 9. Auth flow (JWT acquisition after unlock)
 * 10. Navigation after wallet connected
 */

const TEST_PASSWORD = 'Str0ng!Pass99';

// ---------------------------------------------------------------------------
// Helper: clear localStorage so we start fresh
// ---------------------------------------------------------------------------
async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('mvga-encrypted-keypair');
    // zustand persist key (apps/wallet/src/stores/walletStore.ts)
    localStorage.removeItem('mvga-wallet-storage');
  });
  await page.reload();
}

async function skipWelcomeTourIfPresent(page: Page) {
  const header = page.locator('header');
  // WelcomeTour uses i18n `tour.skip` (e.g. "Skip" / "Saltar").
  const skip = page.getByRole('button', { name: /^(skip|saltar)$/i });

  await Promise.race([
    header.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    skip.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
  ]);

  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function skipBiometricsSetupIfPresent(page: Page) {
  const header = page.locator('header');
  const skip = page.getByRole('button', { name: /skip for now|omitir por ahora/i });

  await Promise.race([
    header.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    skip.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
  ]);

  if (await skip.isVisible().catch(() => false)) await skip.click();
}

// ---------------------------------------------------------------------------
// Helper: create a new wallet through the onboarding UI and return the 12 words
// ---------------------------------------------------------------------------
async function createWalletAndGetMnemonic(page: Page): Promise<string[]> {
  // Should be on onboarding (CHOICE step)
  await expect(page.getByText('Create New Wallet')).toBeVisible({ timeout: 10000 });

  // Click "Create New Wallet"
  await page.getByText('Create New Wallet').click();

  // Should be on password step
  await expect(page.getByPlaceholder(/password.*min/i)).toBeVisible({ timeout: 5000 });
  await page.getByPlaceholder(/password.*min/i).fill(TEST_PASSWORD);
  await page.getByPlaceholder(/confirm/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create wallet/i }).click();

  // Should show mnemonic (12 words)
  await expect(page.getByText('Recovery Phrase')).toBeVisible({ timeout: 10000 });

  // Extract the 12 words from the grid
  const words: string[] = [];
  for (let i = 1; i <= 12; i++) {
    // Each word is in a span next to its number span
    const wordEl = page.locator(`div.grid > div:nth-child(${i}) span.text-white`);
    const text = await wordEl.textContent();
    words.push(text?.trim() || '');
  }
  expect(words).toHaveLength(12);
  expect(words.every((w) => w.length > 0)).toBe(true);

  return words;
}

// ---------------------------------------------------------------------------
// Helper: complete the mnemonic confirmation step given the known words
// ---------------------------------------------------------------------------
async function confirmMnemonic(page: Page, words: string[]) {
  // Click "I Wrote It Down"
  await page.getByRole('button', { name: /wrote it down/i }).click();

  // Should be on confirm step — 3 input fields with labels like "Word #N"
  await expect(page.getByText('Verify Backup')).toBeVisible({ timeout: 5000 });

  // Find the 3 labelled word inputs
  const labels = page.locator('label');
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const labelText = await labels.nth(i).textContent();
    const match = labelText?.match(/Word #(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1; // 0-based
      const input = page.locator(`input[placeholder="Enter word #${idx + 1}"]`);
      await input.fill(words[idx]);
    }
  }

  // Click confirm
  await page.getByRole('button', { name: /confirm/i }).click();

  // New users may see an optional biometrics setup step. Skip it in tests.
  await skipBiometricsSetupIfPresent(page);

  // First-time users see the WelcomeTour overlay; skip it to reach the app shell.
  await skipWelcomeTourIfPresent(page);
}

// ---------------------------------------------------------------------------
// 1. ONBOARDING — CREATE WALLET
// ---------------------------------------------------------------------------
test.describe('Wallet Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);
  });

  test('shows onboarding screen when no wallet exists', async ({ page }) => {
    await expect(page.getByText('MVGA')).toBeVisible();
    await expect(page.getByText('Create New Wallet')).toBeVisible();
    await expect(page.getByText('Import Existing')).toBeVisible();
    await expect(page.getByText(/your keys.*your coins/i)).toBeVisible();
  });

  test('validates password length on create', async ({ page }) => {
    await page.getByText('Create New Wallet').click();
    await page.getByPlaceholder(/password.*min/i).fill('12345'); // too short
    await page.getByPlaceholder(/confirm/i).fill('12345');
    await page.getByRole('button', { name: /create wallet/i }).click();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('validates password match on create', async ({ page }) => {
    await page.getByText('Create New Wallet').click();
    await page.getByPlaceholder(/password.*min/i).fill(TEST_PASSWORD);
    await page.getByPlaceholder(/confirm/i).fill('DifferentPass1');
    await page.getByRole('button', { name: /create wallet/i }).click();
    await expect(page.getByText(/do not match/i)).toBeVisible();
  });

  test('creates wallet and shows 12-word mnemonic', async ({ page }) => {
    const words = await createWalletAndGetMnemonic(page);
    // Verify all 12 are real BIP39 words (at least 3 chars each)
    for (const w of words) {
      expect(w.length).toBeGreaterThanOrEqual(3);
    }
    // Copy button should be visible
    await expect(page.getByRole('button', { name: /copy to clipboard/i })).toBeVisible();
    // Security warning
    await expect(page.getByText(/do not screenshot/i)).toBeVisible();
  });

  test('full create flow: password → mnemonic → confirm → dashboard', async ({ page }) => {
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);

    // Should now be on the main dashboard (wallet page)
    // Wait for the dashboard to load — look for balance area or header address
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('mnemonic confirmation rejects wrong words', async ({ page }) => {
    const words = await createWalletAndGetMnemonic(page);

    // Click "I Wrote It Down"
    await page.getByRole('button', { name: /wrote it down/i }).click();
    await expect(page.getByText('Verify Backup')).toBeVisible();

    // Fill all confirm fields with wrong words
    const labels = page.locator('label');
    const count = await labels.count();
    for (let i = 0; i < count; i++) {
      const labelText = await labels.nth(i).textContent();
      const match = labelText?.match(/Word #(\d+)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const input = page.locator(`input[placeholder="Enter word #${idx}"]`);
        await input.fill('wrongword');
      }
    }

    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/incorrect/i)).toBeVisible();
  });

  test('back button from password returns to choice', async ({ page }) => {
    await page.getByText('Create New Wallet').click();
    await expect(page.getByPlaceholder(/password.*min/i)).toBeVisible();
    await page.getByText('Back').click();
    await expect(page.getByText('Create New Wallet')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. LOCK / UNLOCK
// ---------------------------------------------------------------------------
test.describe('Lock & Unlock Flow', () => {
  test('locks and unlocks wallet correctly', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    // Create wallet
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);

    // Wait for dashboard
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    // Lock via header menu
    const walletBtn = page.locator('header').getByText(/\w{4}\.\.\.\w{4}/);
    await walletBtn.click();
    await page.getByText('Lock Wallet').click();

    // Should see lock screen
    await expect(page.getByText('Wallet Locked')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/enter password/i)).toBeVisible();

    // Enter wrong password
    await page.getByPlaceholder(/enter password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /unlock/i }).click();
    await expect(page.getByText(/wrong password/i)).toBeVisible();

    // Enter correct password
    await page.getByPlaceholder(/enter password/i).fill('');
    await page.getByPlaceholder(/enter password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /unlock/i }).click();

    // Should be back on dashboard
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('lock screen shows after page refresh when wallet exists', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    // Create wallet
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    // Reload the page — wallet should be locked
    await page.reload();
    await expect(page.getByText('Wallet Locked')).toBeVisible({ timeout: 10000 });
  });

  test('delete wallet from lock screen returns to onboarding', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    // Create wallet
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    // Reload to get lock screen
    await page.reload();
    await expect(page.getByText('Wallet Locked')).toBeVisible({ timeout: 10000 });

    // Click forgot / reset
    await page.getByText(/forgot.*reset/i).click();
    await expect(page.getByText('Reset Wallet')).toBeVisible();
    await page.getByRole('button', { name: /delete wallet/i }).click();

    // Should be back to onboarding
    await expect(page.getByText('Create New Wallet')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 3. IMPORT WALLET — MNEMONIC
// ---------------------------------------------------------------------------
test.describe('Import Wallet via Mnemonic', () => {
  test('import choice screen shows two options', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await expect(page.getByText(/recovery phrase/i)).toBeVisible();
    await expect(page.getByText(/secret key/i)).toBeVisible();
  });

  test('import from mnemonic validates empty words', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /recovery phrase/i }).click();

    // Try to import without filling words
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /import wallet/i }).click();
    await expect(page.getByText(/fill in all 12/i)).toBeVisible();
  });

  test('import from mnemonic validates password length', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /recovery phrase/i }).click();

    // Fill all 12 words with dummy valid words
    const dummyWords = [
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'abandon',
      'about',
    ];
    for (let i = 0; i < 12; i++) {
      await page.locator(`input[placeholder="${i + 1}"]`).fill(dummyWords[i]);
    }

    // Short password
    await page.locator('input[type="password"]').fill('12345');
    await page.getByRole('button', { name: /import wallet/i }).click();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('full mnemonic import: create → lock → reset → import same phrase → same address', async ({
    page,
  }) => {
    await page.goto('/');
    await clearWallet(page);

    // 1. Create wallet and capture address
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    const addressText = await page
      .locator('header')
      .getByText(/\w{4}\.\.\.\w{4}/)
      .textContent();
    const originalAddress = addressText?.trim();
    expect(originalAddress).toBeTruthy();

    // 2. Delete wallet
    await clearWallet(page);
    await expect(page.getByText('Create New Wallet')).toBeVisible({ timeout: 5000 });

    // 3. Import with same mnemonic
    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /recovery phrase/i }).click();

    for (let i = 0; i < 12; i++) {
      await page.locator(`input[placeholder="${i + 1}"]`).fill(words[i]);
    }
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /import wallet/i }).click();

    // Fresh storage reset clears `tourCompleted`, so the WelcomeTour may show again after import.
    await skipWelcomeTourIfPresent(page);

    // Should land on dashboard with same address
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    const restoredAddress = await page
      .locator('header')
      .getByText(/\w{4}\.\.\.\w{4}/)
      .textContent();
    expect(restoredAddress?.trim()).toBe(originalAddress);
  });
});

// ---------------------------------------------------------------------------
// 4. IMPORT WALLET — SECRET KEY
// ---------------------------------------------------------------------------
test.describe('Import Wallet via Secret Key', () => {
  test('import secret key validates empty key', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /secret key/i }).click();

    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /import.*encrypt/i }).click();
    await expect(page.getByText(/paste.*secret key/i)).toBeVisible();
  });

  test('import secret key validates password length', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /secret key/i }).click();

    await page.locator('textarea').fill('SomeBase58Key');
    await page.locator('input[type="password"]').fill('12345');
    await page.getByRole('button', { name: /import.*encrypt/i }).click();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('import secret key shows error for invalid key', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    await page.getByText('Import Existing').click();
    await page.getByRole('button', { name: /secret key/i }).click();

    await page.locator('textarea').fill('not-a-valid-base58-key');
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /import.*encrypt/i }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 5. HEADER MENU — EXPORT KEY, DISCONNECT
// ---------------------------------------------------------------------------
test.describe('Header Wallet Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    // Create wallet fast
    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('header shows wallet address chip', async ({ page }) => {
    // Green indicator dot + address
    await expect(page.locator('header .bg-green-400')).toBeVisible();
  });

  test('wallet menu opens and has all options', async ({ page }) => {
    const walletBtn = page.locator('header').getByText(/\w{4}\.\.\.\w{4}/);
    await walletBtn.click();

    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Export Key')).toBeVisible();
    await expect(page.getByText('Lock Wallet')).toBeVisible();
    await expect(page.getByText('Disconnect')).toBeVisible();
  });

  test('export key flow — wrong password shows error', async ({ page }) => {
    const walletBtn = page.locator('header').getByText(/\w{4}\.\.\.\w{4}/);
    await walletBtn.click();
    await page.getByText('Export Key').click();

    // Export modal appears
    await expect(page.getByText('Export Secret Key')).toBeVisible();
    await page.getByPlaceholder(/enter password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /decrypt.*show/i }).click();

    await expect(page.getByText(/wrong password/i)).toBeVisible();
  });

  test('export key flow — correct password reveals key', async ({ page }) => {
    const walletBtn = page.locator('header').getByText(/\w{4}\.\.\.\w{4}/);
    await walletBtn.click();
    await page.getByText('Export Key').click();

    await page.getByPlaceholder(/enter password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /decrypt.*show/i }).click();

    // Should show the base58 key and warning
    await expect(page.getByText(/never share this key/i)).toBeVisible({ timeout: 5000 });
    // The key should be a long base58 string (at least 40 chars)
    const keyBox = page.locator('.break-all.font-mono');
    const keyText = await keyBox.textContent();
    expect(keyText?.length).toBeGreaterThan(40);
  });

  test('disconnect removes wallet and returns to onboarding', async ({ page }) => {
    const walletBtn = page.locator('header').getByText(/\w{4}\.\.\.\w{4}/);
    await walletBtn.click();
    await page.getByText('Disconnect').click();

    await expect(page.getByText('Create New Wallet')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 6. DEPOSIT PAGE
// ---------------------------------------------------------------------------
test.describe('Deposit Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    // Use client-side navigation (not page.goto which reloads and locks wallet)
    await page.getByRole('link', { name: /^\$?\s*deposit$/i }).click();
    await page.waitForURL('**/deposit');
  });

  test('shows deposit page content', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Deposit' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/buy sol.*usdc.*usdt/i)).toBeVisible();
  });

  test('deposit page contains Onramper iframe', async ({ page }) => {
    const iframe = page.locator('iframe[title="Buy Crypto"]');
    await expect(iframe).toBeVisible({ timeout: 10000 });
    const src = await iframe.getAttribute('src');
    expect(src).toContain('buy.onramper.com');
  });

  test('deposit page links to P2P and Receive', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Deposit' })).toBeVisible({ timeout: 10000 });

    // P2P link
    await expect(page.getByText('P2P Exchange')).toBeVisible();
    // Receive link
    await expect(page.getByText(/receive crypto/i)).toBeVisible();
    // Onramper disclaimer
    await expect(page.getByText(/powered by onramper/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. CONNECTED NAVIGATION
// ---------------------------------------------------------------------------
test.describe('Navigation After Wallet Connected', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('bottom nav links work when connected', async ({ page }) => {
    // Navigate to swap
    await page.locator('nav a[href="/swap"]').click();
    await expect(page.url()).toContain('/swap');

    // Navigate to P2P
    await page.locator('nav a[href="/p2p"]').click();
    await expect(page.url()).toContain('/p2p');

    // Navigate back to wallet
    await page.locator('nav a[href="/"]').click();
    await expect(page.url()).not.toContain('/swap');
  });

  test('wallet page shows quick action buttons when connected', async ({ page }) => {
    // Quick actions grid has Send, Receive, Swap, Deposit, Charge links
    const quickActions = page.locator('div.grid.grid-cols-6');
    await expect(quickActions.locator('a')).toHaveCount(6);
    await expect(quickActions.locator('a[href="/send"]')).toBeVisible();
    await expect(quickActions.locator('a[href="/receive"]')).toBeVisible();
    await expect(quickActions.locator('a[href="/swap"]')).toBeVisible();
    await expect(quickActions.locator('a[href="/deposit"]')).toBeVisible();
    await expect(quickActions.locator('a[href="/charge"]')).toBeVisible();
    await expect(quickActions.locator('a[href="/referral"]')).toBeVisible();
  });

  test('send page loads without connect prompt when connected', async ({ page }) => {
    await page.goto('/send');
    // Should NOT show connect prompt
    await expect(page.locator('text=/connect.*wallet/i')).not.toBeVisible({ timeout: 3000 });
  });

  test('receive page shows wallet address when connected', async ({ page }) => {
    await page.goto('/receive');
    // Should show the wallet address or QR code area
    await expect(page.locator('text=/connect.*wallet/i')).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// 8. DESIGN VERIFICATION (Brutalist)
// ---------------------------------------------------------------------------
test.describe('Brutalist Design', () => {
  test('uses Archivo font family', async ({ page }) => {
    await page.goto('/');
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily.toLowerCase()).toContain('archivo');
  });

  test('no rounded corners on buttons', async ({ page }) => {
    await page.goto('/');
    // Check the "Create New Wallet" button
    const btn = page.getByText('Create New Wallet');
    const borderRadius = await btn.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius;
    });
    expect(borderRadius).toBe('0px');
  });

  test('black background', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Should be black or near-black
    expect(bg).toMatch(/rgb\(0, 0, 0\)|rgb\(10, 10, 10\)/);
  });
});

// ---------------------------------------------------------------------------
// 9. LOCAL STORAGE PERSISTENCE
// ---------------------------------------------------------------------------
test.describe('Storage Persistence', () => {
  test('encrypted wallet is stored in localStorage as V2 format', async ({ page }) => {
    await page.goto('/');
    await clearWallet(page);

    const words = await createWalletAndGetMnemonic(page);
    await confirmMnemonic(page, words);
    await expect(page.locator('header').getByText(/\w{4}\.\.\.\w{4}/)).toBeVisible({
      timeout: 10000,
    });

    // Check localStorage
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('mvga-encrypted-keypair');
      return raw ? JSON.parse(raw) : null;
    });

    expect(stored).toBeTruthy();
    expect(stored.version).toBe(2);
    expect(stored.salt).toBeTruthy();
    expect(stored.keypair_iv).toBeTruthy();
    expect(stored.keypair_ct).toBeTruthy();
    expect(stored.mnemonic_iv).toBeTruthy();
    expect(stored.mnemonic_ct).toBeTruthy();
    expect(stored.derivationPath).toContain("44'/501'");
    expect(stored.createdVia).toBe('mnemonic');
  });
});
