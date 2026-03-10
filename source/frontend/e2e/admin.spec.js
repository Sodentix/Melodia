import { test, expect } from '@playwright/test';

test.describe('Admin', () => {
  test('redirects unauthenticated user to auth', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('redirects regular user to home', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL || 'user@test.local';
    const password = process.env.E2E_USER_PASSWORD || 'TestPass12!@';

    await page.goto('/auth');
    await page.getByLabel(/E-Mail/i).fill(email);
    await page.getByLabel(/Passwort/i).fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 5000 });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/home/);
  });

  test('shows admin area for admin user', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL || 'admin@test.local';
    const password = process.env.E2E_ADMIN_PASSWORD || 'TestPass12!@';

    await page.goto('/auth');
    await page.getByLabel(/E-Mail/i).fill(email);
    await page.getByLabel(/Passwort/i).fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 5000 });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: /Admin-Bereich/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Benutzer/i })).toBeVisible();
  });
});
