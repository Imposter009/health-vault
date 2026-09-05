import { test, expect } from './fixtures/auth.fixture';

test.describe('Metrics entry → Dashboard', () => {

  test('add a weight metric and verify it appears in the list', async ({ authedPage: page }) => {
    await page.goto('/metrics/add');

    // Select metric type
    const typeSelect = page.getByLabel(/metric type|type/i);
    await typeSelect.selectOption('WEIGHT');

    // Fill in weight
    await page.getByLabel(/weight|kg/i).fill('72.5');

    // Recorded at (today by default in most forms — ensure it's set)
    const dateInput = page.getByLabel(/recorded.?at|date/i);
    if (await dateInput.count() > 0) {
      await dateInput.fill(new Date().toISOString().slice(0, 10));
    }

    await page.getByRole('button', { name: /save|submit|add/i }).click();

    // Should redirect to list or dashboard
    await page.waitForURL(/\/(metrics|dashboard)/, { timeout: 10_000 });

    // Navigate to metrics list to verify
    await page.goto('/metrics');
    await expect(page.locator('body')).toContainText('72.5', { timeout: 8_000 });
  });

  test('dashboard chart area renders for the default 30-day period', async ({ authedPage: page }) => {
    await page.goto('/dashboard');

    // Metric type selector should be visible
    const metricSelect = page.getByLabel(/metric/i);
    await expect(metricSelect).toBeVisible({ timeout: 8_000 });

    // Preset buttons
    await expect(page.getByRole('button', { name: '30 d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '7 d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '90 d' })).toBeVisible();

    // Chart canvas should be present in the DOM
    await expect(page.locator('canvas')).toBeAttached();
  });

  test('switching granularity to WEEK re-loads dashboard', async ({ authedPage: page }) => {
    await page.goto('/dashboard');

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Intercept next dashboard API call
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/metrics/dashboard') && resp.request().method() === 'GET',
      { timeout: 10_000 }
    );

    await page.getByLabel(/granularity/i).selectOption('WEEK');

    const resp = await responsePromise;
    expect(resp.status()).toBe(200);
  });
});
