import { test, expect } from '@playwright/test';
import { uniqueEmail, PASSWORD, registerAndLogin, login } from './fixtures/auth.fixture';

test.describe('Authentication', () => {

  test('register a new user and land on the dashboard', async ({ page }) => {
    const email = await registerAndLogin(page);

    // Should be on the main authenticated area
    await expect(page).toHaveURL(/\/(dashboard|metrics|home)/);

    // App should show the user's email or a greeting somewhere
    await expect(page.locator('body')).toContainText(email, { timeout: 8_000 });
  });

  test('login → logout → protected route redirects to /login', async ({ page }) => {
    const email = uniqueEmail();

    // Register first
    await page.goto('/register');
    await page.getByLabel('Full name', { exact: false }).fill('Logout Test');
    await page.getByLabel('Email', { exact: false }).fill(email);
    const pwFields = page.getByLabel('Password', { exact: false });
    await pwFields.first().fill(PASSWORD);
    if (await pwFields.count() > 1) await pwFields.last().fill(PASSWORD);
    await page.getByRole('button', { name: /register|sign up/i }).click();
    await page.waitForURL(/\/(dashboard|metrics|home)/);

    // Logout (button in nav bar or header)
    await page.getByRole('button', { name: /log.?out|sign.?out/i }).click();

    // After logout, navigate to a protected route
    await page.goto('/metrics');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test('login with wrong password shows error', async ({ page }) => {
    const email = uniqueEmail();

    // Register
    await page.goto('/register');
    await page.getByLabel('Full name', { exact: false }).fill('PW Test');
    await page.getByLabel('Email', { exact: false }).fill(email);
    const pwFields = page.getByLabel('Password', { exact: false });
    await pwFields.first().fill(PASSWORD);
    if (await pwFields.count() > 1) await pwFields.last().fill(PASSWORD);
    await page.getByRole('button', { name: /register|sign up/i }).click();
    await page.waitForURL(/\/(dashboard|metrics|home)/);

    // Logout
    await page.getByRole('button', { name: /log.?out|sign.?out/i }).click();

    // Try to log in with wrong password
    await page.goto('/login');
    await page.getByLabel('Email', { exact: false }).fill(email);
    await page.getByLabel('Password', { exact: false }).fill('WrongPassword!');
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    // Should remain on /login and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/invalid|incorrect|unauthorized/i, { timeout: 5_000 });
  });

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    // Clear any existing session
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});
