import { test as base, Page } from '@playwright/test';

/** Unique email per test run — avoids conflicts when tests run in parallel. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.invalid`;
}

export const PASSWORD = 'SecureE2E@1234';

/**
 * Register a new user and log in via the UI.
 * Returns the email used so tests can assert on it.
 */
export async function registerAndLogin(page: Page): Promise<string> {
  const email = uniqueEmail();

  await page.goto('/register');

  // Wait for the form to appear
  await page.getByLabel('Full name', { exact: false }).fill('E2E User');
  await page.getByLabel('Email', { exact: false }).fill(email);

  // Most pages have two password fields on register
  const pwFields = page.getByLabel('Password', { exact: false });
  await pwFields.first().fill(PASSWORD);
  if (await pwFields.count() > 1) {
    await pwFields.last().fill(PASSWORD);
  }

  await page.getByRole('button', { name: /register|sign up/i }).click();

  // After registration the app redirects to dashboard
  await page.waitForURL(/\/(dashboard|metrics|home)/, { timeout: 15_000 });

  return email;
}

/** Log in with an existing account. */
export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|metrics|home)/, { timeout: 15_000 });
}

/** Fixture that extends the base test with a pre-authenticated page. */
export const test = base.extend<{ authedPage: Page; email: string }>({
  authedPage: async ({ page }, use) => {
    await registerAndLogin(page);
    await use(page);
  },
  email: async ({ page }, use) => {
    const email = await registerAndLogin(page);
    await use(email);
  },
});

export { expect } from '@playwright/test';
