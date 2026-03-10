import { test, expect } from '@playwright/test';

test.describe('Reset Password', () => {
  test('shows request form when no token', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('h1')).toHaveText('Passwort vergessen');
    await expect(page.getByPlaceholder('name@email.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Link anfordern/i })).toBeVisible();
  });

  test('submits email and shows message', async ({ page }) => {
    await page.goto('/reset-password');
    await page.getByPlaceholder('name@email.com').fill('test@example.com');
    await page.getByRole('button', { name: /Link anfordern/i }).click();
    await expect(page.locator('.reset-feedback')).toBeVisible({ timeout: 5000 });
  });

  test('shows reset form when token in URL', async ({ page }) => {
    await page.goto('/reset-password?token=invalid123');
    await expect(page.locator('h1')).toHaveText('Neues Passwort');
    await expect(page.getByPlaceholder('Neues Passwort')).toBeVisible();
    await expect(page.getByPlaceholder('Wiederholen')).toBeVisible();
  });

  test('shows error for invalid/expired token', async ({ page }) => {
    await page.goto('/reset-password?token=invalid123');
    await page.getByPlaceholder('Neues Passwort').fill('NewPassword12!@');
    await page.getByPlaceholder('Wiederholen').fill('NewPassword12!@');
    await page.getByRole('button', { name: /Passwort speichern/i }).click();
    await expect(page.locator('.reset-feedback.error')).toContainText(/ungültig|abgelaufen|invalid|expired/i, {
      timeout: 5000,
    });
  });
});
