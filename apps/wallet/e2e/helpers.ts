import { expect, Page } from '@playwright/test';

const TEST_PASSWORD = 'Str0ng!Pass99';

/** Clear localStorage so we start fresh */
export async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('mvga-encrypted-keypair');
    // zustand persist key (apps/wallet/src/stores/walletStore.ts)
    localStorage.removeItem('mvga-wallet-storage');
  });
  await page.reload();
}

async function skipWelcomeTourIfPresent(page: Page): Promise<boolean> {
  // WelcomeTour uses i18n `tour.skip` (e.g. "Skip" / "Saltar").
  const skip = page.getByRole('button', { name: /^(skip|saltar)$/i });

  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.scrollIntoViewIfNeeded().catch(() => {});
  await skip.click({ timeout: 5000 });
  return true;
}

async function skipBiometricsSetupIfPresent(page: Page): Promise<boolean> {
  // Onboarding "Enable biometrics" step has an explicit "Skip for now" button.
  const skip = page.getByRole('button', { name: /skip for now|omitir por ahora/i });

  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.scrollIntoViewIfNeeded().catch(() => {});
  await skip.click({ timeout: 5000 });
  return true;
}

async function skipProfileSetupIfPresent(page: Page): Promise<boolean> {
  // Onboarding "Setup Profile" step has a "Skip for now" button.
  // Match specifically the profile skip button (not the biometrics one which uses different text).
  const skip = page.getByRole('button', { name: /^skip for now$|^omitir por ahora$/i });

  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.scrollIntoViewIfNeeded().catch(() => {});
  await skip.click({ timeout: 5000 });
  return true;
}

async function completeCitizenRevealIfPresent(page: Page): Promise<boolean> {
  // Onboarding "Citizen Reveal" step has a CTA button to enter the app.
  const cta = page.getByRole('button', { name: /see my card|ver mi carnet/i });

  if (!(await cta.isVisible().catch(() => false))) return false;
  await cta.scrollIntoViewIfNeeded().catch(() => {});
  await cta.click({ timeout: 5000 });
  return true;
}

async function unlockIfLocked(page: Page): Promise<boolean> {
  const passwordInput = page.getByPlaceholder(/enter password|ingresa tu contraseña/i);
  if (!(await passwordInput.isVisible().catch(() => false))) return false;

  await passwordInput.fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /unlock|desbloquear/i }).click();
  return true;
}

async function skipOnboardingWizardIfPresent(page: Page): Promise<boolean> {
  // OnboardingWizard overlay has a "Skip Tour" / "Saltar Tour" button.
  const skip = page.getByRole('button', { name: /skip tour|saltar tour/i });

  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.scrollIntoViewIfNeeded().catch(() => {});
  await skip.click({ timeout: 5000 });
  // Wait for the overlay to be fully removed from the DOM
  await page
    .locator('[data-testid="onboarding-wizard-overlay"]')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {});
  return true;
}

async function waitForAppShell(page: Page) {
  const header = page.locator('header');
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    // Handle whichever blocking screen is currently visible.
    const acted =
      (await skipBiometricsSetupIfPresent(page)) ||
      (await skipProfileSetupIfPresent(page)) ||
      (await completeCitizenRevealIfPresent(page)) ||
      (await unlockIfLocked(page)) ||
      (await skipWelcomeTourIfPresent(page)) ||
      (await skipOnboardingWizardIfPresent(page));

    if (acted) {
      await page.waitForTimeout(250);
      continue;
    }

    if (await header.isVisible().catch(() => false)) {
      // Header is visible — but wizard overlay might still be on top.
      // Give it one more chance to dismiss.
      await skipOnboardingWizardIfPresent(page);
      return;
    }

    await page.waitForTimeout(250);
  }

  await expect(header).toBeVisible({ timeout: 10000 });
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

  // ACCEPT_RISKS step — check the consent checkbox and continue
  const risksCheckbox = page.locator('input[type="checkbox"]');
  await expect(risksCheckbox).toBeVisible({ timeout: 10000 });
  await risksCheckbox.check();
  await page.getByRole('button', { name: /continue|continuar/i }).click();

  // Mnemonic step — extract words
  await expect(page.locator('text=/recovery phrase|frase de recuperación/i').first()).toBeVisible({
    timeout: 10000,
  });

  // Words are hidden by default — click "Reveal words" to show them
  const revealBtn = page.getByRole('button', { name: /reveal words|mostrar palabras/i });
  if (await revealBtn.isVisible().catch(() => false)) {
    await revealBtn.click();
  }

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
  const confirm = page.getByRole('button', { name: /confirm/i });
  await confirm.scrollIntoViewIfNeeded().catch(() => {});
  await confirm.click({ timeout: 10000 });

  // After confirmation, the app may show: optional biometrics setup, WelcomeTour,
  // or (if a full reload happened) the LockScreen. Normalize to the main shell.
  await waitForAppShell(page);
}
