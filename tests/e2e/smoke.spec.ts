import { test, expect } from '@playwright/test';

test.describe('Mini-EDMS Smoke Tests', () => {
  test('Login page loads and displays brand title', async ({ page }) => {
    await page.goto('/login');
    
    // Check for the brand name
    await expect(page.locator('h1')).toContainText('Mini-EDMS');
    
    // Check for the subtitle
    await expect(page.locator('p')).toContainText('Система електронного документообігу');
    
    // Check for the login button
    await expect(page.locator('button[type="submit"]')).toContainText('Увійти в систему');
  });

  test('Shows error message on invalid login attempt', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    
    // Click submit
    await page.locator('button[type="submit"]').click();
    
    // Check for error message
    // (Assuming the backend is running and the authentication logic works as tested in Jest)
    // The previous Jest test for auth showed that invalid password results in 401.
    const errorAlert = page.locator('div.text-red-600');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Invalid email or password');
  });
});
