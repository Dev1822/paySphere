import { test, expect } from '@playwright/test';

/**
 * BenefitsEnrollmentCard End-to-End Tests
 *
 * Issue: #1516
 *
 * Covers:
 *  - Rendering of BenefitsEnrollmentCard components inside the telemetry tab.
 *  - Premium, contributions, and progress bar calculations.
 *  - Expansion/collapse states containing dependents list and YTD spending metrics.
 *  - Keyboard accessibility (Enter and Space key triggers).
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(page, email, password) {
    await page.goto('/auth');
    await page.waitForSelector('#login-email', { timeout: 10_000 });
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('BenefitsEnrollmentCard E2E Suite', () => {

    test.beforeEach(async ({ page }) => {
        // Authenticate the session
        await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
        // Navigate to the Enterprise Benefits & Compensation dashboard
        await page.goto('/enterprise/benefits-compensation');
        // Wait for active tab layouts
        await page.waitForSelector('text=Active Benefit Plans', { timeout: 10_000 });
    });

    test('should switch to open enrollment tab and render enrollment cards with proper details', async ({ page }) => {
        // Switch to the Open Enrollment Stream tab
        await page.locator('text=Open Enrollment Stream').click();

        // Verify the enrollment card list is visible
        const grid = page.locator('#benefits-enrollment-grid');
        await expect(grid).toBeVisible({ timeout: 5000 });

        // Verify that four enrollment cards are rendered in the grid
        const cards = grid.locator('role=button');
        await expect(cards).toHaveCount(4);

        // Verify employee names are rendered on their respective cards
        await expect(grid.locator('text=Elena Rostova')).toBeVisible();
        await expect(grid.locator('text=Marcus Vance')).toBeVisible();
        await expect(grid.locator('text=David Chen')).toBeVisible();
        await expect(grid.locator('text=Sarah Jenkins')).toBeVisible();

        // Verify some card details (e.g. Elena Rostova - Engineering - Premium/Share)
        await expect(grid.locator('text=Engineering • Platinum PPO Healthcare & Vision')).toBeVisible();
        await expect(grid.locator('text=$770')).toBeVisible();
        await expect(grid.locator('text=$120').first()).toBeVisible();

        // Verify the employer contribution ratio text (e.g. 650 / 770 = 84% covered)
        await expect(grid.locator('text=84% covered')).toBeVisible();

        // Verify the status badge (e.g. pending, active, waived)
        await expect(grid.locator('text=active').first()).toBeVisible();
        await expect(grid.locator('text=pending')).toBeVisible();
        await expect(grid.locator('text=waived')).toBeVisible();
    });

    test('should toggle expansion and collapse states to reveal dependents and metrics on click', async ({ page }) => {
        // Switch to Open Enrollment tab
        await page.locator('text=Open Enrollment Stream').click();

        const grid = page.locator('#benefits-enrollment-grid');
        // Elena Rostova is the first card
        const elenaCard = grid.locator('role=button').first();

        // Dependents section should not be visible initially
        await expect(page.locator('text=Dependents')).not.toBeVisible();
        await expect(page.locator('text=YTD Employer Spend')).not.toBeVisible();

        // Expand the card on click
        await elenaCard.click();

        // Verify dependents list and details section appear
        await expect(page.locator('text=Dependents')).toBeVisible();
        await expect(page.locator('text=Ivan Rostov (Spouse)')).toBeVisible();
        await expect(page.locator('text=Anya Rostova (Child)')).toBeVisible();

        // Verify financial overview calculations in details
        await expect(page.locator('text=YTD Employer Spend')).toBeVisible();
        await expect(page.locator('text=$5,850')).toBeVisible();
        await expect(page.locator('text=$1,440')).toBeVisible(); // $120 * 12 annual share

        // Collapse card on second click
        await elenaCard.click();

        // Verify dependents list is hidden again
        await expect(page.locator('text=Dependents')).not.toBeVisible();
    });

    test('should support keyboard focus navigation and triggers', async ({ page }) => {
        // Switch to Open Enrollment tab
        await page.locator('text=Open Enrollment Stream').click();

        // Focus first element on page using Tab
        await page.keyboard.press('Tab');

        // Locating first enrollment card and focusing it
        const firstCard = page.locator('#benefits-enrollment-grid > div').first();
        await firstCard.focus();

        // Dependents details section should not be visible
        await expect(page.locator('text=Dependents')).not.toBeVisible();

        // Trigger expansion with Enter key
        await page.keyboard.press('Enter');
        await expect(page.locator('text=Dependents')).toBeVisible();

        // Collapse with Space key
        await page.keyboard.press('Space');
        await expect(page.locator('text=Dependents')).not.toBeVisible();
    });
});
