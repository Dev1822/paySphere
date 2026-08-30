import { test, expect } from '@playwright/test';

/**
 * CompensationBandCard End-to-End Tests
 *
 * Issue: #1517
 *
 * Covers:
 *  - Rendering of the CompensationBandCard within the Benefits & Compensation dashboard.
 *  - Tab switching between plans, enrollment stream, and compensation bands.
 *  - Card expansion/collapse states.
 *  - User interactions such as clicking the Compare button.
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

test.describe('CompensationBandCard E2E Suite', () => {

    test.beforeEach(async ({ page }) => {
        // Authenticate the session
        await loginAs(page, TEST_EMAIL, TEST_PASSWORD);
        // Navigate to the Enterprise Benefits & Compensation dashboard
        await page.goto('/enterprise/benefits-compensation');
        // Wait for the tab layout to load
        await page.waitForSelector('#compensation-bands-tab', { timeout: 10_000 });
    });

    test('should switch tabs and render the CompensationBandCard grid with proper metrics', async ({ page }) => {
        // Initially, the active benefit plans tab should be active
        await expect(page.locator('text=Active Benefit Plans')).toBeVisible();

        // Switch to the Compensation Bands tab
        const compTab = page.locator('#compensation-bands-tab');
        await compTab.click();

        // Verify the compensation bands grid is visible
        const grid = page.locator('#compensation-bands-grid');
        await expect(grid).toBeVisible({ timeout: 5000 });

        // Verify that three compensation grade cards are rendered
        const cards = grid.locator('role=button');
        await expect(cards).toHaveCount(3);

        // Verify that individual card data (e.g. Executive, Director, Manager) is correct
        await expect(grid.locator('text=Executive Leadership Band')).toBeVisible();
        await expect(grid.locator('text=Engineering Director Band')).toBeVisible();
        await expect(grid.locator('text=Engineering Manager Band')).toBeVisible();

        // Check that default values/metrics like headcount and bonus target are rendering correctly
        await expect(grid.locator('text=San Francisco, CA • 5 employees')).toBeVisible();
        await expect(grid.locator('text=35%').first()).toBeVisible();
    });

    test('should toggle expand and collapse detailed comparisons on click', async ({ page }) => {
        // Switch to the Compensation Bands tab
        await page.locator('#compensation-bands-tab').click();

        const grid = page.locator('#compensation-bands-grid');
        const executiveCard = grid.locator('role=button').first();

        // Detailed market percentile comparison should not be visible initially
        await expect(page.locator('text=Market Percentile Comparison')).not.toBeVisible();

        // Click the card to expand
        await executiveCard.click();

        // Detailed percentile labels and bars should be visible
        await expect(page.locator('text=Market Percentile Comparison')).toBeVisible();
        await expect(page.locator('text=Band Min')).toBeVisible();
        await expect(page.locator('text=Market P25')).toBeVisible();
        await expect(page.locator('text=Midpoint')).toBeVisible();
        await expect(page.locator('text=Market P50')).toBeVisible();
        await expect(page.locator('text=Market P75')).toBeVisible();
        await expect(page.locator('text=Band Max')).toBeVisible();

        // Click the card again to collapse it
        await executiveCard.click();

        // Detailed section should disappear
        await expect(page.locator('text=Market Percentile Comparison')).not.toBeVisible();
    });

    test('should support keyboard navigation accessibility controls', async ({ page }) => {
        // Switch to the Compensation Bands tab
        await page.locator('#compensation-bands-tab').click();

        // Focus on the tab and use keyboard to navigate
        await page.keyboard.press('Tab');
        
        // Detailed market comparison should not be visible initially
        await expect(page.locator('text=Market Percentile Comparison')).not.toBeVisible();

        // Locate the first card and focus it (or hit Enter on current focused element)
        const firstCard = page.locator('#compensation-bands-grid > div').first();
        await firstCard.focus();
        await page.keyboard.press('Enter');

        // Verify that keyboard expand works
        await expect(page.locator('text=Market Percentile Comparison')).toBeVisible();

        // Press Space to collapse
        await page.keyboard.press('Space');
        await expect(page.locator('text=Market Percentile Comparison')).not.toBeVisible();
    });

    test('should trigger compare callback when clicking the compare button', async ({ page }) => {
        // Track console outputs to assert on compare triggers
        const consoleMessages = [];
        page.on('console', msg => {
            consoleMessages.push(msg.text());
        });

        // Switch to the Compensation Bands tab
        await page.locator('#compensation-bands-tab').click();

        // Locate the Compare button inside the first card (Executive)
        const compareBtn = page.locator('.compare-btn').first();
        await expect(compareBtn).toBeVisible();

        // Click the compare button
        await compareBtn.click();

        // Verify the mock click logic callback was triggered in the console
        await expect.poll(() => consoleMessages).toContain('Comparing grade: executive');
    });
});
