import { test, expect } from '@playwright/test';

/**
 * Critical User Journeys for Issue #472.
 *
 * These tests exercise the real frontend + backend together rather than
 * mocking API responses:
 *   1. Login -> Dashboard -> Add Employee
 *   2. Login -> Run Payroll -> Download Payslips
 *
 * The CI seeder creates a deterministic employee fixture for the payroll CUJ.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';
const PAYROLL_EMPLOYEE = 'E2E Payroll Employee';

async function login(page) {
  await page.goto('/auth');
  await page.locator('#login-email, input[type="email"]').first().fill(TEST_EMAIL);
  await page.locator('#login-password, input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL('**/dashboard', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/dashboard/);
}

async function addEmployee(page, name) {
  await page.goto('/add-employee');
  await expect(page.getByRole('heading', { name: /add employee/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('Role / Designation').fill('E2E Tester');
  await page.getByLabel('Department').fill('Engineering');
  await page.getByLabel('Monthly Salary').fill('60000');
  await page.getByLabel('Overtime Rate (per hour)').fill('400');
  await page.getByRole('button', { name: /^add employee$/i }).click();

  await page.waitForURL('**/dashboard?tab=employees', { timeout: 20_000 });
}

test.describe('Issue #472 - Critical User Journeys', () => {
  test('Login -> View Dashboard -> Add Employee', async ({ page }) => {
    const employeeName = `E2E CUJ Employee ${Date.now()}`;

    await test.step('Login', async () => {
      await login(page);
    });

    await test.step('Verify dashboard is available', async () => {
      await expect(page.locator('body')).toContainText(/dashboard|employees/i);
    });

    await test.step('Open Add Employee and create an employee', async () => {
      await addEmployee(page, employeeName);
    });

    await test.step('Verify the employee was persisted and displayed', async () => {
      await expect(page.locator('body')).toContainText(employeeName, {
        timeout: 15_000,
      });
    });
  });

  test('Login -> Run Payroll -> Download Payslips', async ({ page }) => {
    await test.step('Login', async () => {
      await login(page);
    });

    await test.step('Open the payroll runner', async () => {
      await page.goto('/monthly-updates');
      await expect(page.getByRole('heading', { name: 'Select Pay Period' })).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step('Select the deterministic payroll employee', async () => {
      // Step 1: pay period -> Step 2: employee review.
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Include Employees' })).toBeVisible();

      const employeeRow = page.locator('label').filter({ hasText: PAYROLL_EMPLOYEE }).first();
      await expect(employeeRow).toBeVisible({ timeout: 15_000 });

      const checkbox = employeeRow.locator('input[type="checkbox"]');
      await expect(checkbox).toBeChecked();
    });

    await test.step('Review and finalize payroll', async () => {
      // Step 2 -> Step 3: adjustments.
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Add Adjustments' })).toBeVisible();

      // Step 3 -> Step 4: anomaly review.
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Anomaly Review' })).toBeVisible();
      await expect(page.locator('body')).toContainText(/No anomalies detected|Checking anomalies/i);

      await expect(page.getByText('No anomalies detected. You can proceed.')).toBeVisible({
        timeout: 15_000,
      });

      // Step 4 -> Step 5 -> Step 6.
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Batch Summary' })).toBeVisible();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Final Confirmation' })).toBeVisible();

      const confirmation = page
        .locator('label')
        .filter({ hasText: /I confirm that the payroll data is correct/i })
        .locator('input[type="checkbox"]');
      await confirmation.check();

      await page.getByRole('button', { name: 'Submit Payroll' }).click();
      await expect(page.getByRole('heading', { name: 'Payroll Finalized' })).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('Download the generated payslips', async () => {
      await page.goto('/reports');
      await expect(page.getByRole('button', { name: 'Download All Payslips ZIP' })).toBeVisible({
        timeout: 20_000,
      });

      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await page.getByRole('button', { name: 'Download All Payslips ZIP' }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename().toLowerCase()).toMatch(/payslips-.*\.zip$/);
      const path = await download.path();
      expect(path).toBeTruthy();
    });
  });
});
