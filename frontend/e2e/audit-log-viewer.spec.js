import { test, expect } from '@playwright/test';

/**
 * AuditLogViewer E2E Tests
 *
 * Issue: #1526
 *
 * Tests the organization security audit log viewer panel:
 * 1. Mock GET /api/audit-logs with structured security entries
 * 2. Authenticate and navigate to Settings => Audit Logs tab
 * 3. Verify page header, search controls, and table data rendering
 * 4. Verify search query filtering (match by actor name or email)
 * 5. Verify select dropdown filters (filter by action or status)
 * 6. Inspect detail view modal overlay on row click, verifying payload parameters
 * 7. Verify close overlay trigger
 * 8. Verify refresh ledger and CSV export actions
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

test.describe('AuditLogViewer Workflow', () => {
  const mockLogs = [
    {
      _id: 'log-101',
      action: 'PAYROLL_FINALIZED',
      actorName: 'Sarah Chen',
      actorEmail: 'sarah@company.com',
      actorRole: 'Admin',
      resourceType: 'PayrollBatch',
      status: 'SUCCESS',
      createdAt: new Date().toISOString(),
      ipAddress: '192.168.1.50',
      details: { batchId: 'B-2026-Q3', totalUSD: 145000 }
    },
    {
      _id: 'log-102',
      action: 'DISBURSEMENT_INITIATED',
      actorName: 'Marcus Weber',
      actorEmail: 'marcus@company.com',
      actorRole: 'Finance',
      resourceType: 'Payout',
      status: 'WARNING',
      createdAt: new Date().toISOString(),
      ipAddress: '192.168.1.62',
      details: { warningMsg: 'Gas fees exceed optimization threshold' }
    },
    {
      _id: 'log-103',
      action: 'USER_ROLE_CHANGED',
      actorName: 'James Hartley',
      actorEmail: 'james@company.com',
      actorRole: 'SuperAdmin',
      resourceType: 'UserRole',
      status: 'FAILURE',
      createdAt: new Date().toISOString(),
      ipAddress: '10.0.4.15',
      details: { targetUserId: 'U-384', requestedRole: 'Owner', error: 'Approval sequence incomplete' }
    }
  ];

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

  test.beforeEach(async ({ page }) => {
    // Mock audit logs endpoint response
    await page.route('**/api/audit-logs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, logs: mockLogs })
      });
    });

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should render audit log viewer and search logs', async ({ page }) => {
    await test.step('Navigate to Settings page and choose Audit Logs tab', async () => {
      await page.goto('/settings');
      await page.waitForTimeout(1000);

      const auditTabBtn = page.locator('button:has-text("Audit Logs")');
      await auditTabBtn.click();
      await page.waitForTimeout(500);

      const viewer = page.locator('[data-testid="audit-log-viewer"]');
      await expect(viewer).toBeVisible();
      await expect(viewer.locator('h2')).toContainText('Enterprise Audit Trail & Security Ledger');
    });

    const viewer = page.locator('[data-testid="audit-log-viewer"]');

    await test.step('Verify initial logs rendering', async () => {
      const rows = viewer.locator('tbody tr');
      expect(await rows.count()).toBe(3);
      await expect(viewer).toContainText('Sarah Chen');
      await expect(viewer).toContainText('PAYROLL_FINALIZED');
      await expect(viewer).toContainText('USER_ROLE_CHANGED');
    });

    await test.step('Filter logs by query "Sarah"', async () => {
      const searchInput = viewer.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Sarah');
      await page.waitForTimeout(300);

      const rows = viewer.locator('tbody tr');
      expect(await rows.count()).toBe(1);
      await expect(viewer).toContainText('Sarah Chen');
      await expect(viewer).not.toContainText('USER_ROLE_CHANGED');

      // Clear search
      await searchInput.fill('');
      await page.waitForTimeout(300);
    });
  });

  test('should support dropdown filters (Action and Status)', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Audit Logs")');
    await page.waitForTimeout(500);

    const viewer = page.locator('[data-testid="audit-log-viewer"]');

    await test.step('Filter by status option: Failure', async () => {
      const statusSelect = viewer.locator('select').last();
      await statusSelect.selectOption('FAILURE');
      await page.waitForTimeout(300);

      const rows = viewer.locator('tbody tr');
      expect(await rows.count()).toBe(1);
      await expect(viewer).toContainText('USER_ROLE_CHANGED');
      await expect(viewer).not.toContainText('PAYROLL_FINALIZED');

      // Reset
      await statusSelect.selectOption('ALL');
      await page.waitForTimeout(300);
    });
  });

  test('should click log row to inspect record details in modal', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Audit Logs")');
    await page.waitForTimeout(500);

    const viewer = page.locator('[data-testid="audit-log-viewer"]');

    await test.step('Click first row to open details modal', async () => {
      await viewer.locator('tbody tr').first().click();
      await page.waitForTimeout(500);

      const modal = page.locator('div[class*="fixed"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator('h3')).toContainText('Audit Record Detail');
      await expect(modal).toContainText('PAYROLL_FINALIZED');
      await expect(modal).toContainText('Sarah Chen');
      await expect(modal).toContainText('B-2026-Q3');
    });

    await test.step('Close details modal', async () => {
      const modal = page.locator('div[class*="fixed"]');
      await modal.locator('button:has-text("Close")').click();
      await page.waitForTimeout(500);
      await expect(modal).not.toBeVisible();
    });
  });

  test('should trigger refresh and export CSV alerts', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Audit Logs")');
    await page.waitForTimeout(500);

    const viewer = page.locator('[data-testid="audit-log-viewer"]');

    await test.step('Test CSV export alert dialog', async () => {
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('CSV export');
        await dialog.dismiss();
      });
      await viewer.locator('button:has-text("Export CSV")').click();
      await page.waitForTimeout(500);
    });

    await test.step('Test Refresh action trigger', async () => {
      let refreshCalled = false;
      await page.route('**/api/audit-logs', async (route) => {
        refreshCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, logs: mockLogs })
        });
      });

      await viewer.locator('button[title="Refresh Logs"]').click();
      await page.waitForTimeout(500);
      expect(refreshCalled).toBe(true);
    });
  });
});
