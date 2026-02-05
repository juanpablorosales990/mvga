import { test, expect } from '@playwright/test';

test.describe('PWA Manifest', () => {
  test('manifest is accessible and has correct metadata', async ({ page }) => {
    await page.goto('/');

    // The manifest link should exist in the HTML
    const manifestLink = page.locator('link[rel="manifest"]');
    const href = await manifestLink.getAttribute('href');
    expect(href).toBeTruthy();

    // Fetch the manifest
    const response = await page.request.get(href!);
    expect(response.ok()).toBeTruthy();

    const manifest = await response.json();

    expect(manifest.name).toBe('MVGA Wallet');
    expect(manifest.short_name).toBe('MVGA');
    expect(manifest.theme_color).toBe('#f59e0b');
    expect(manifest.background_color).toBe('#0a0a0a');
    expect(manifest.display).toBe('standalone');
  });

  test('manifest includes required icon sizes', async ({ page }) => {
    await page.goto('/');

    const manifestLink = page.locator('link[rel="manifest"]');
    const href = await manifestLink.getAttribute('href');
    const response = await page.request.get(href!);
    const manifest = await response.json();

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  test('all icons are PNG format', async ({ page }) => {
    await page.goto('/');

    const manifestLink = page.locator('link[rel="manifest"]');
    const href = await manifestLink.getAttribute('href');
    const response = await page.request.get(href!);
    const manifest = await response.json();

    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
    }
  });
});
