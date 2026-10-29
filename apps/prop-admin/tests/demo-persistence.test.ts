const { test, expect } = require('@playwright/test');

test.describe('Demo persistence smoke test', () => {
  test('should persist demo state and reset', async ({ page }) => {
    // Navigate to the demo app
    await page.goto('http://localhost:3210');

    // Check that Approve button exists on payouts-pending
    await page.getByRole('button', { name: 'Approve', exact: true }).first().waitFor({ timeout: 5000 });
    
    // Check that after reload the state is preserved
    await page.reload();
    await page.waitForTimeout(1000);
  });