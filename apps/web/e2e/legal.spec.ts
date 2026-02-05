import { test, expect } from '@playwright/test';

test.describe('Privacy Policy Page', () => {
  test('loads and shows heading', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('shows all 7 sections', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: '1. Information We Collect' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2. How We Use Your Data' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. Data Sharing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '4. Data Security' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '5. Your Rights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '6. Cookies' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '7. Contact' })).toBeVisible();
  });

  test('has back to home link', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: '1. Acceptance of Terms' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2. Description of Service' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. User Responsibilities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '4. Risks' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '5. No Warranty' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '6. Limitation of Liability' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '7. P2P Exchange Terms' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '8. Modifications' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '9. Contact' })).toBeVisible();
  });

  test('has back to home link', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
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
