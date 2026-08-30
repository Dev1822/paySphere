import { test, expect } from '@playwright/test';

/**
 * NotificationDropdown E2E Tests
 *
 * Issue: #1524
 *
 * Tests the notification alert and details dropdown workflow:
 * 1. Mock GET /api/notifications with structured notifications
 * 2. Click the bell button in the Navbar to open the dropdown
 * 3. Assert correct rendering of notification details, icons, and categories
 * 4. Verify unread vs all tab filtering
 * 5. Verify single notification read toggles (clicking an item updates count)
 * 6. Verify "Mark all as read" updates state across the component
 * 7. Close dropdown via close icon and verify visibility
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

test.describe('NotificationDropdown Workflow', () => {
  // Mock notifications array
  const mockNotifications = [
    {
      _id: 'notif-1',
      title: 'Payroll Settlement Succeeded',
      message: 'August batch transfer completed with gas optimization.',
      type: 'PAYROLL',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/settlements'
    },
    {
      _id: 'notif-2',
      title: 'Compliance Audit Required',
      message: 'Update information security policies before review.',
      type: 'COMPLIANCE',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/enterprise/compliance-audit'
    },
    {
      _id: 'notif-3',
      title: 'Expense Report Approved',
      message: 'Travel expenses for international tech offsite approved.',
      type: 'EXPENSE',
      isRead: true,
      createdAt: new Date().toISOString(),
      link: '/expenses'
    }
  ];

  test.beforeEach(async ({ page }) => {
    // Intercept notifications API call with mock payload
    await page.route('**/api/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          notifications: mockNotifications,
          unreadCount: mockNotifications.filter(n => !n.isRead).length
        })
      });
    });

    // Intercept individual mark-as-read API call
    await page.route('**/api/notifications/*/read', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Intercept mark-all-as-read API call
    await page.route('**/api/notifications/read-all', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, modifiedCount: 2 })
      });
    });

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
  });

  test('should toggle notification dropdown and display list content', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const bellBtn = page.locator('button[aria-label="Notifications"]').first();
    await expect(bellBtn).toBeVisible();

    // Verify unread badge count
    await expect(bellBtn).toContainText('2');

    await test.step('Open Notification dropdown', async () => {
      await bellBtn.click();
      await page.waitForTimeout(500);

      const dropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).toBeVisible();
      await expect(dropdown.locator('h3')).toContainText('Notifications');
      await expect(dropdown).toContainText('2 new');
    });

    await test.step('Verify item rendering details', async () => {
      const dropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).toContainText('Payroll Settlement Succeeded');
      await expect(dropdown).toContainText('Compliance Audit Required');
      await expect(dropdown).toContainText('Expense Report Approved');
    });

    await test.step('Close Notification dropdown via close button', async () => {
      const closeBtn = page.locator('[data-testid="notification-dropdown"] button:has(svg)').first();
      await closeBtn.click();
      await page.waitForTimeout(500);

      const dropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).not.toBeVisible();
    });
  });

  test('should filter unread notifications and handle mark as read action', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const bellBtn = page.locator('button[aria-label="Notifications"]').first();
    await bellBtn.click();
    await page.waitForTimeout(500);

    const dropdown = page.locator('[data-testid="notification-dropdown"]');

    await test.step('Verify initial filter tab counts', async () => {
      await expect(dropdown.locator('button:has-text("All")')).toContainText('3');
      await expect(dropdown.locator('button:has-text("Unread")')).toContainText('2');
    });

    await test.step('Filter unread only', async () => {
      await dropdown.locator('button:has-text("Unread")').click();
      await page.waitForTimeout(300);

      // Verify read notifications are hidden
      await expect(dropdown).not.toContainText('Expense Report Approved');
      await expect(dropdown).toContainText('Payroll Settlement Succeeded');
    });

    await test.step('Click unread notification to mark as read', async () => {
      // Toggle back to All tab
      await dropdown.locator('button:has-text("All")').click();
      await page.waitForTimeout(300);

      // Click first unread item
      const unreadItem = dropdown.locator('div:has-text("Payroll Settlement Succeeded")').last();
      await unreadItem.click();
      await page.waitForTimeout(500);

      // Unread badge count should decrement
      await expect(bellBtn).toContainText('1');
    });
  });

  test('should support marking all notifications as read', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const bellBtn = page.locator('button[aria-label="Notifications"]').first();
    await bellBtn.click();
    await page.waitForTimeout(500);

    const dropdown = page.locator('[data-testid="notification-dropdown"]');

    await test.step('Mark all notifications read', async () => {
      const markAllBtn = dropdown.locator('button:has-text("Mark all")');
      await markAllBtn.click();
      await page.waitForTimeout(500);

      // Unread badges should disappear
      await expect(bellBtn.locator('span')).not.toBeVisible();
      await expect(dropdown.locator('span:has-text("new")')).not.toBeVisible();
    });
  });
});
