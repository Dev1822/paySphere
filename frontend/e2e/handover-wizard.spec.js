import { test, expect } from '@playwright/test';

/**
 * HandoverWizard E2E Tests
 *
 * Issue: #1527
 *
 * Tests the multi-step employee offboarding/handover wizard workflow:
 * 1. Mock GET /api/employees and POST /api/handover/initiate
 * 2. Authenticate and navigate to Settlements dashboard page
 * 3. Click "Initiate Handover" to open the wizard modal
 * 4. Step 1: select employee from list, continue
 * 5. Step 2: edit exit date, select handover templates checklist
 * 6. Test Step 2 Back navigation (returns to Step 1 with state preserved)
 * 7. Step 3: submit form, assert success indicator, close wizard
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

test.describe('HandoverWizard Workflow', () => {
  const mockEmployees = [
    {
      _id: 'emp-101',
      fullName: 'Alice Johnson',
      email: 'alice@company.com',
      department: 'Engineering',
      role: 'Senior Software Engineer'
    },
    {
      _id: 'emp-102',
      fullName: 'Bob Smith',
      email: 'bob@company.com',
      department: 'Sales',
      role: 'Sales Representative'
    }
  ];

  test.beforeEach(async ({ page }) => {
    // Intercept employee list endpoint
    await page.route('**/api/employees**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, employees: mockEmployees })
      });
    });

    // Intercept initiate handover plan endpoint
    await page.route('**/api/handover/initiate', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          plan: { _id: 'plan-777', status: 'In Progress' }
        })
      });
    });

    // Intercept add knowledge transfer endpoint
    await page.route('**/api/handover/knowledge-transfer', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should execute full handover wizard initiation flow', async ({ page }) => {
    await page.goto('/settlements');
    await page.waitForTimeout(1000);

    // Verify Settlements page loaded and has initiate button
    const initBtn = page.locator('button:has-text("Initiate Handover")');
    await expect(initBtn).toBeVisible();

    await test.step('Open Handover Wizard Modal', async () => {
      await initBtn.click();
      await page.waitForTimeout(500);

      const wizard = page.locator('[data-testid="handover-wizard"]');
      await expect(wizard).toBeVisible();
      await expect(wizard.locator('h2')).toContainText('Offboarding Handover Wizard');
      await expect(wizard.locator('p').first()).toContainText('Step 1 of 3: Select Employee');
    });

    const wizard = page.locator('[data-testid="handover-wizard"]');

    await test.step('Step 1: Select Employee and continue', async () => {
      const selectDropdown = wizard.locator('select[name="employeeId"]');
      await expect(selectDropdown).toBeVisible();

      // Choose Alice Johnson
      await selectDropdown.selectOption('emp-101');
      await page.waitForTimeout(300);

      // Verify department info displays
      await expect(wizard).toContainText('Engineering');
      await expect(wizard).toContainText('Senior Software Engineer');

      // Click continue
      await wizard.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(500);

      await expect(wizard.locator('p').first()).toContainText('Step 2 of 3: Exit Rules & Templates');
    });

    await test.step('Step 2: Verify controls and navigation back/forth', async () => {
      // Test Back button
      await wizard.locator('button:has-text("Back")').click();
      await page.waitForTimeout(500);

      // Verify selected employee is preserved
      await expect(wizard.locator('select[name="employeeId"]')).toHaveValue('emp-101');

      // Return to step 2
      await wizard.locator('button:has-text("Continue")').click();
      await page.waitForTimeout(500);
    });

    await test.step('Step 2: Customize checklists and submit', async () => {
      const exitDateInput = wizard.locator('input[name="exitDate"]');
      await expect(exitDateInput).toBeVisible();
      await exitDateInput.fill('2026-09-30');

      // Uncheck process runbooks template
      const processCheckbox = wizard.locator('input[type="checkbox"]').last();
      await processCheckbox.uncheck();

      // Submit
      await wizard.locator('button[type="submit"]:has-text("Initiate Offboarding")').click();
      await page.waitForTimeout(800);

      // Verify Step 3: Success Confirmation
      await expect(wizard.locator('h3')).toContainText('Handover Plan Created Successfully');
    });

    await test.step('Step 3: Close Wizard', async () => {
      await wizard.locator('button:has-text("Done")').click();
      await page.waitForTimeout(500);

      await expect(wizard).not.toBeVisible();
    });
  });
});
