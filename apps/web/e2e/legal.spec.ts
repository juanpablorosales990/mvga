import { test, expect } from '@playwright/test';

test.describe('Privacy Policy Page', () => {
  test('loads and shows heading', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('shows all 7 sections', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Information We Collect' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How We Use Your Data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Sharing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data Security' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your Rights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cookies' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
  });

  test('shows last updated date', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText('Last updated')).toBeVisible();
  });
});

test.describe('Terms of Service Page', () => {
  test('loads and shows heading', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  });

  test('shows all 9 sections', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Acceptance of Terms' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Description of Service' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User Responsibilities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Risks' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No Warranty' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Limitation of Liability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'P2P Exchange Terms' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Modifications' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
  });
});

test.describe('404 Page', () => {
  test('shows 404 for nonexistent page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('has Go Home link', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('link', { name: 'Go Home' })).toBeVisible();
  });
});

test.describe('Footer Legal Links', () => {
  test('home page footer has privacy and terms links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
  });
});
