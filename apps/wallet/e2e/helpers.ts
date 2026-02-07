import { expect, Page } from '@playwright/test';

const TEST_PASSWORD = 'Str0ng!Pass99';

/** Clear localStorage so we start fresh */
export async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('mvga-encrypted-keypair');
    localStorage.removeItem('mvga-wallet-store');
  });
  await page.reload();
}

/** Create a new wallet through the onboarding UI, confirm mnemonic, and land on dashboard */
export async function createWalletAndUnlock(page: Page) {
  await page.goto('/');
  await clearWallet(page);

  // Should be on onboarding
  await expect(page.locator('text=/create new wallet|crear nueva billetera/i')).toBeVisible({
    timeout: 10000,
  });

  // Click "Create New Wallet"
  await page.locator('text=/create new wallet|crear nueva billetera/i').click();

  // Password step
  await expect(page.getByPlaceholder(/password.*min|contraseña.*mín/i)).toBeVisible({
    timeout: 5000,
  });
  await page.getByPlaceholder(/password.*min|contraseña.*mín/i).fill(TEST_PASSWORD);
  await page.getByPlaceholder(/confirm|confirmar/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /create wallet|crear billetera/i }).click();

  // Mnemonic step — extract words
  await expect(page.locator('text=/recovery phrase|frase de recuperación/i').first()).toBeVisible({
    timeout: 10000,
  });

  const words: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const wordEl = page.locator(`div.grid > div:nth-child(${i}) span.text-white`);
    const text = await wordEl.textContent();
    words.push(text?.trim() || '');
  }

  // Click "I Wrote It Down"
  await page.getByRole('button', { name: /wrote it down|ya las anoté/i }).click();

  // Confirm mnemonic — fill 3 word inputs
  await expect(page.locator('text=/verify backup|verificar respaldo/i')).toBeVisible({
    timeout: 5000,
  });

  const labels = page.locator('label');
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const labelText = await labels.nth(i).textContent();
    const match = labelText?.match(/#(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      // Use regex with end anchor to avoid #1 matching #10, #11, #12
      const input = page.getByPlaceholder(new RegExp(`#${idx + 1}$`));
      await input.fill(words[idx]);
    }
  }

  // Click confirm
  await page.getByRole('button', { name: /confirm|confirmar/i }).click();

  // Should land on dashboard (header visible)
  await expect(page.locator('header')).toBeVisible({ timeout: 10000 });
}
