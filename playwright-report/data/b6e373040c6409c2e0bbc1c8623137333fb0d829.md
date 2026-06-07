# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Mini-EDMS Smoke Tests >> Login page loads and displays brand title
- Location: tests/e2e/smoke.spec.ts:4:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('p')
Expected substring: "Система електронного документообігу"
Error: strict mode violation: locator('p') resolved to 2 elements:
    1) <p class="text-slate-500 mt-2 font-medium">Система електронного документообігу</p> aka getByText('Система електронного документообігу')
    2) <p class="text-xs text-slate-400">© 2026 Mini-EDMS. Всі права захищено.</p> aka getByText('© 2026 Mini-EDMS')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('p')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Mini-EDMS" [level=1] [ref=e10]
    - paragraph [ref=e11]: Система електронного документообігу
  - generic [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Електронна пошта
        - generic [ref=e16]:
          - img [ref=e17]
          - textbox "name@company.com" [ref=e20]
      - generic [ref=e21]:
        - generic [ref=e22]: Пароль
        - generic [ref=e23]:
          - img [ref=e24]
          - textbox "••••••••" [ref=e27]
      - button "Увійти в систему" [ref=e28]
    - paragraph [ref=e30]: © 2026 Mini-EDMS. Всі права захищено.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Mini-EDMS Smoke Tests', () => {
  4  |   test('Login page loads and displays brand title', async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     
  7  |     // Check for the brand name
  8  |     await expect(page.locator('h1')).toContainText('Mini-EDMS');
  9  |     
  10 |     // Check for the subtitle
> 11 |     await expect(page.locator('p')).toContainText('Система електронного документообігу');
     |                                     ^ Error: expect(locator).toContainText(expected) failed
  12 |     
  13 |     // Check for the login button
  14 |     await expect(page.locator('button[type="submit"]')).toContainText('Увійти в систему');
  15 |   });
  16 | 
  17 |   test('Shows error message on invalid login attempt', async ({ page }) => {
  18 |     await page.goto('/login');
  19 |     
  20 |     // Fill in invalid credentials
  21 |     await page.locator('input[type="email"]').fill('invalid@example.com');
  22 |     await page.locator('input[type="password"]').fill('wrongpassword');
  23 |     
  24 |     // Click submit
  25 |     await page.locator('button[type="submit"]').click();
  26 |     
  27 |     // Check for error message
  28 |     // (Assuming the backend is running and the authentication logic works as tested in Jest)
  29 |     // The previous Jest test for auth showed that invalid password results in 401.
  30 |     const errorAlert = page.locator('div.text-red-600');
  31 |     await expect(errorAlert).toBeVisible();
  32 |     await expect(errorAlert).toContainText('Invalid email or password');
  33 |   });
  34 | });
  35 | 
```