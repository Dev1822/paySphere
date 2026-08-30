import { test, expect } from '@playwright/test';

/**
 * UserProfile Workflow E2E Tests
 *
 * Issue: #1523
 *
 * Tests the user profile dashboard and settings interface:
 * 1. Authenticate and navigate to `/profile`
 * 2. Verify rendering of personal profile inputs and read-only attributes
 * 3. Verify personal profile editing, blank/invalid validation, and success toast
 * 4. Verify Account Security tab (Change Password regex validations)
 * 5. Verify Notifications tab (toggle preference switches)
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

test.describe('UserProfile Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render user profile settings and static details correctly', async ({ page }) => {
    await test.step('Navigate to Profile settings page', async () => {
      await page.goto('/profile');
      await page.waitForTimeout(1000);
    });

    await test.step('Verify tab buttons and profile header', async () => {
      await expect(page.locator('button:has-text("Profile")').first()).toBeVisible();
      await expect(page.locator('button:has-text("Account Security")')).toBeVisible();
      await expect(page.locator('button:has-text("Notifications")')).toBeVisible();
      await expect(page.locator('h2:has-text("Personal Profile")')).toBeVisible();
    });

    await test.step('Verify read-only role and payroll details', async () => {
      await expect(page.locator('label:has-text("Role / Designation")')).toBeVisible();
      await expect(page.locator('label:has-text("Payroll ID")')).toBeVisible();
    });
  });

  test('should edit profile settings and handle field validation checks', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(1000);

    const nameInput = page.locator('label:has-text("Full Name") + input');
    const emailInput = page.locator('label:has-text("Email Address") + input');
    const saveBtn = page.locator('button:has-text("Save Changes")');

    await test.step('Verify blank name validation', async () => {
      await nameInput.fill('');
      await saveBtn.click();
      await page.waitForTimeout(300);

      const nameError = page.locator('p:has-text("Full Name is required")');
      await expect(nameError).toBeVisible();
    });

    await test.step('Verify malformed email validation', async () => {
      await nameInput.fill('Admin User');
      await emailInput.fill('malformed-email');
      await saveBtn.click();
      await page.waitForTimeout(300);

      const emailError = page.locator('p:has-text("valid email address")');
      await expect(emailError).toBeVisible();
    });

    await test.step('Successfully update profile settings and verify toast', async () => {
      await nameInput.fill('Updated Admin Name');
      await emailInput.fill(TEST_EMAIL);
      await saveBtn.click();
      
      // Verify success toast alert is displayed
      const toastAlert = page.locator('.toast-success, div:has-text("updated successfully"), div:has-text("Profile updated")').first();
      await expect(toastAlert).toBeVisible({ timeout: 10_000 });
    });
  });

  test('should support password update validation in Account Security tab', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(1000);

    await test.step('Switch to Account Security tab', async () => {
      await page.click('button:has-text("Account Security")');
      await page.waitForTimeout(500);
      await expect(page.locator('h2:has-text("Account Security")')).toBeVisible();
    });

    const currentPwdInput = page.locator('input[placeholder="Current Password"]');
    const newPwdInput = page.locator('input[placeholder="New Password"]');
    const updatePwdBtn = page.locator('button:has-text("Update Password")');

    await test.step('Attempt update with too short password', async () => {
      await currentPwdInput.fill(TEST_PASSWORD);
      await newPwdInput.fill('weak');
      await updatePwdBtn.click();
      await page.waitForTimeout(500);

      // Verify weak password warning toast
      const errorToast = page.locator('div:has-text("at least 8 characters"), div:has-text("uppercase")').first();
      await expect(errorToast).toBeVisible();
    });
  });

  test('should toggle notification settings in Notifications tab', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForTimeout(1000);

    await test.step('Switch to Notifications tab', async () => {
      await page.click('button:has-text("Notifications")');
      await page.waitForTimeout(500);
      await expect(page.locator('h2:has-text("Notifications")')).toBeVisible();
    });

    await test.step('Verify and toggle notification switch options', async () => {
      const completionToggle = page.locator('input[aria-label="Payroll completion notifications"]');
      await expect(completionToggle).toBeVisible();

      const initialState = await completionToggle.isChecked();
      
      // Click toggle label wrapper to change checkbox state
      await page.locator('label:has(input[aria-label="Payroll completion notifications"])').first().click();
      await page.waitForTimeout(300);

      const finalState = await completionToggle.isChecked();
      expect(finalState).toBe(!initialState);
    });
  });
});
