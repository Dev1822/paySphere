import { test, expect } from '@playwright/test';

/**
 * SettingsPanel Workflow E2E Tests
 *
 * Issue: #1525
 *
 * Tests the system settings configuration dashboard panel:
 * 1. Authenticate and navigate to Settings page, choosing System Settings tab
 * 2. Verify rendering of default organizational parameters
 * 3. Verify General tab edits (Company Name, Timezone, Billing Email) and success save triggers
 * 4. Verify Payroll tab edits (Fiscal Month, currency selections, micro-expense approval thresholds)
 * 5. Verify Security tab toggles (MFA enforcement check)
 * 6. Verify Attendance tab checkboxes (TOIL encashment, Biometric geo-clocking options)
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

async function loginAs(page, email, password) {
  await page.goto('/auth');
  await page.waitForSelector('input[type="email"], #login-email', { timeout: 10_000 });
  const emailInput = page.locator('input[type="email"], #login-email').first();
  const passwordInput = page.locator('input[type="password"], #login-password').first();

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

test.describe('SettingsPanel Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render organization settings layout and General tab fields', async ({ page }) => {
    await test.step('Navigate to Settings page and choose System Settings tab', async () => {
      await page.goto('/settings');
      await page.waitForTimeout(1000);
      
      const systemTabBtn = page.locator('button:has-text("System Settings")');
      await systemTabBtn.click();
      await page.waitForTimeout(500);

      const panel = page.locator('[data-testid="settings-panel"]');
      await expect(panel).toBeVisible();
      await expect(panel.locator('h2')).toContainText('Organization & System Settings');
    });

    const panel = page.locator('[data-testid="settings-panel"]');

    await test.step('Verify General tab input fields', async () => {
      await expect(panel.locator('input[name="companyName"]')).toBeVisible();
      await expect(panel.locator('select[name="timezone"]')).toBeVisible();
      await expect(panel.locator('input[name="notificationEmail"]')).toBeVisible();
    });

    await test.step('Edit General settings and verify success alert', async () => {
      await panel.locator('input[name="companyName"]').fill('PaySphere Global Corp');
      await panel.locator('select[name="timezone"]').selectOption('Europe/London');
      await panel.locator('input[name="notificationEmail"]').fill('admin-finance@paysphere.io');

      await panel.locator('button[type="submit"]:has-text("Save Configuration")').click();
      await page.waitForTimeout(500);

      await expect(panel.locator('span:has-text("saved successfully")')).toBeVisible();
    });
  });

  test('should edit and save Payroll & Fiscal options', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("System Settings")');
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="settings-panel"]');

    await test.step('Switch to Payroll & Fiscal tab', async () => {
      await panel.locator('button:has-text("Payroll & Fiscal")').click();
      await page.waitForTimeout(300);
      await expect(panel.locator('select[name="fiscalYearStart"]')).toBeVisible();
      await expect(panel.locator('select[name="defaultCurrency"]')).toBeVisible();
    });

    await test.step('Modify currency and auto-approve threshold options', async () => {
      await panel.locator('select[name="fiscalYearStart"]').selectOption('January');
      await panel.locator('select[name="defaultCurrency"]').selectOption('USD');
      await panel.locator('input[name="autoApproveExpensesUnder"]').fill('1500');

      await panel.locator('button[type="submit"]:has-text("Save Configuration")').click();
      await page.waitForTimeout(500);

      await expect(panel.locator('span:has-text("saved successfully")')).toBeVisible();
    });
  });

  test('should toggle Security MFA enforcement', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("System Settings")');
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="settings-panel"]');

    await test.step('Switch to Security & MFA tab', async () => {
      await panel.locator('button:has-text("Security & MFA")').click();
      await page.waitForTimeout(300);
    });

    await test.step('Toggle MFA checkbox and save', async () => {
      const mfaCheckbox = panel.locator('input[name="mfaEnforced"]');
      await expect(mfaCheckbox).toBeVisible();

      const isChecked = await mfaCheckbox.isChecked();
      if (isChecked) {
        await mfaCheckbox.uncheck();
      } else {
        await mfaCheckbox.check();
      }

      await panel.locator('button[type="submit"]:has-text("Save Configuration")').click();
      await page.waitForTimeout(500);

      await expect(panel.locator('span:has-text("saved successfully")')).toBeVisible();
    });
  });

  test('should toggle Attendance and comp-off TOIL settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("System Settings")');
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="settings-panel"]');

    await test.step('Switch to Attendance & TOIL tab', async () => {
      await panel.locator('button:has-text("Attendance & TOIL")').click();
      await page.waitForTimeout(300);
    });

    await test.step('Toggle biometric clock-in and TOIL encashment', async () => {
      const bioCheckbox = panel.locator('input[name="allowBiometricClockIn"]');
      const toilCheckbox = panel.locator('input[name="allowToilEncashment"]');

      await expect(bioCheckbox).toBeVisible();
      await expect(toilCheckbox).toBeVisible();

      const initialBio = await bioCheckbox.isChecked();
      const initialToil = await toilCheckbox.isChecked();

      if (initialBio) await bioCheckbox.uncheck(); else await bioCheckbox.check();
      if (initialToil) await toilCheckbox.uncheck(); else await toilCheckbox.check();

      await panel.locator('button[type="submit"]:has-text("Save Configuration")').click();
      await page.waitForTimeout(500);

      await expect(panel.locator('span:has-text("saved successfully")')).toBeVisible();
      expect(await bioCheckbox.isChecked()).toBe(!initialBio);
      expect(await toilCheckbox.isChecked()).toBe(!initialToil);
    });
  });
});
