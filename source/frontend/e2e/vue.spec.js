import { test, expect } from '@playwright/test';

test('visits the app root url and redirects to home', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/home/);
  await expect(page.locator('h1')).toHaveText('Kannst du den Song erraten?');
});
