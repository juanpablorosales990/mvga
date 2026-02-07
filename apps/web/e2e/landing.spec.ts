import { test, expect } from '@playwright/test';

test.describe('Landing Page — Hero', () => {
  test('displays hero heading and badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Make Venezuela Great Again')).toBeVisible();
    await expect(page.getByText('Open Source • Community Owned')).toBeVisible();
  });

  test('Open Wallet button links to app.mvga.io', async ({ page }) => {
    await page.goto('/');
    const openWallet = page.locator('a:has-text("Open Wallet")');
    await expect(openWallet).toHaveAttribute('href', 'https://app.mvga.io');
  });

  test('Launch App button links to app.mvga.io', async ({ page }) => {
    await page.goto('/');
    const launchApp = page.locator('a:has-text("Launch App")');
    await expect(launchApp).toHaveAttribute('href', 'https://app.mvga.io');
  });
});

test.describe('Landing Page — Navigation', () => {
  // Nav links are hidden behind a hamburger menu on mobile viewports
  test('nav has all anchor links', async ({ page, browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Nav links hidden on mobile');
    await page.goto('/');
    await expect(page.locator('nav a[href="#mission"]')).toBeVisible();
    await expect(page.locator('nav a[href="#features"]')).toBeVisible();
    await expect(page.locator('nav a[href="#transparency"]')).toBeVisible();
    await expect(page.locator('nav a[href="#tokenomics"]')).toBeVisible();
  });

  test('nav has Grants page link', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Nav links hidden on mobile');
    await page.goto('/');
    await expect(page.locator('a[href="/grants"]')).toBeVisible();
  });
});

test.describe('Landing Page — Mission Section', () => {
  test('shows 3 mission cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Zero Fee Remittances' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Support Local Business' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '100% Open Source' })).toBeVisible();
  });
});

test.describe('Landing Page — Features Section', () => {
  test('shows 4 feature cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'MVGA Wallet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'P2P Exchange' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staking & Rewards' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Business Grants' })).toBeVisible();
  });
});

test.describe('Landing Page — Transparency Section', () => {
  test('shows 6 wallet addresses with Solscan links', async ({ page }) => {
    await page.goto('/');

    const wallets = [
      { name: 'Treasury', address: 'H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE' },
      { name: 'Humanitarian Fund', address: 'HvtvFhuVMu9XGmhW5zWNvtPK7ttiMBg7Ag7C9oRpyKwP' },
      { name: 'Staking Vault', address: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh' },
      { name: 'Team Vesting', address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4' },
      { name: 'Marketing', address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo' },
      { name: 'Advisors', address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF' },
    ];

    for (const w of wallets) {
      await expect(page.locator(`text=${w.name}`).first()).toBeVisible();
      await expect(
        page.locator(`a[href="https://solscan.io/account/${w.address}"]`).first()
      ).toBeVisible();
    }
  });
});

test.describe('Landing Page — Tokenomics Section', () => {
  test('shows token distribution breakdown', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Community & Liquidity').first()).toBeVisible();
    await expect(page.locator('#tokenomics').locator('text=Humanitarian Fund')).toBeVisible();
    await expect(page.locator('text=40%').first()).toBeVisible();
  });

  test('shows token details', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=1,000,000,000')).toBeVisible();
    await expect(page.locator('text=Solana')).toBeVisible();
  });
});

test.describe('Landing Page — External Links', () => {
  test('GitHub link is correct', async ({ page }) => {
    await page.goto('/');
    const githubLink = page.locator('a[href="https://github.com/juanpablorosales990/mvga"]');
    await expect(githubLink.first()).toBeVisible();
  });

  test('Telegram link is correct', async ({ page }) => {
    await page.goto('/');
    const telegramLink = page.locator('a[href="https://t.me/mvga"]');
    await expect(telegramLink.first()).toBeVisible();
  });

  test('Twitter link is correct', async ({ page }) => {
    await page.goto('/');
    const twitterLink = page.locator('a[href="https://twitter.com/mvga"]');
    await expect(twitterLink.first()).toBeVisible();
  });
});

test.describe('Landing Page — Footer', () => {
  test('shows Patria y Vida', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Patria y Vida')).toBeVisible();
  });
});
