import { test, expect } from '@playwright/test';

test.describe('Landing Page — Hero', () => {
  test('displays hero heading and badges', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'YOUR MONEY.' })).toBeVisible();
    await expect(page.getByText('Digital Dollars for Venezuela').first()).toBeVisible();
    await expect(page.getByText('No Bank Required').first()).toBeVisible();
  });

  test('Open Account button links to app.mvga.io', async ({ page }) => {
    await page.goto('/');
    const openAccount = page.locator('a:has-text("Open Your Account")').first();
    await expect(openAccount).toHaveAttribute('href', 'https://app.mvga.io');
  });

  test('See How It Works button links to section', async ({ page }) => {
    await page.goto('/');
    const howItWorks = page.locator('a:has-text("See How It Works")').first();
    await expect(howItWorks).toHaveAttribute('href', '#how-it-works');
  });
});

test.describe('Landing Page — Navigation', () => {
  test('nav has all anchor links', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Nav links hidden on mobile');
    await page.goto('/');
    await expect(page.locator('nav a[href="#mission"]')).toBeVisible();
    await expect(page.locator('nav a[href="#features"]')).toBeVisible();
    await expect(page.locator('nav a[href="#faq"]')).toBeVisible();
  });

  test('nav has Grants page link', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Nav links hidden on mobile');
    await page.goto('/');
    await expect(page.locator('a[href="/grants"]')).toBeVisible();
  });
});

test.describe('Landing Page — Problem Section', () => {
  test('shows 3 problem cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Remittance Fees' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unstable Currency' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No Banking Access' })).toBeVisible();
  });
});

test.describe('Landing Page — Features Section', () => {
  test('shows key feature headings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Free Remittances' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visa Debit Card' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phone Top-Ups' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cash Out to Bank' })).toBeVisible();
  });
});

test.describe('Landing Page — Card Section', () => {
  test('shows Visa card visual', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Spend your dollars anywhere.').first()).toBeVisible();
    await expect(page.getByText('Visa Debit').first()).toBeVisible();
    await expect(page.getByText('Apple Pay').first()).toBeVisible();
  });
});

test.describe('Landing Page — Comparison Table', () => {
  test('shows comparison with Western Union', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Stop losing money to middlemen.').first()).toBeVisible();
    await expect(page.getByText('Western Union').first()).toBeVisible();
    await expect(page.getByText('$200 received').first()).toBeVisible();
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
  test('footer has legal links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
  });
});
