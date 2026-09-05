import { test, expect } from './fixtures/auth.fixture';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('Document upload → view', () => {

  /** Creates a minimal PDF file in the OS temp dir for upload. */
  function makeTempPdf(): string {
    const p = path.join(os.tmpdir(), `hv-e2e-${Date.now()}.pdf`);
    fs.writeFileSync(p, '%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\n%%EOF');
    return p;
  }

  test('upload a PDF and see it in the documents list', async ({ authedPage: page }) => {
    await page.goto('/documents/upload');

    const pdfPath = makeTempPdf();

    // Set the file on the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pdfPath);

    // Select a category if a selector is visible
    const catSelect = page.getByLabel(/category/i);
    if (await catSelect.count() > 0) {
      await catSelect.selectOption('LAB_REPORT');
    }

    // Submit
    await page.getByRole('button', { name: /upload|submit/i }).click();

    // Should redirect to documents list or show success
    await page.waitForURL(/\/documents/, { timeout: 20_000 });

    // Filename must appear in the list
    const filename = path.basename(pdfPath);
    await expect(page.locator('body')).toContainText(filename, { timeout: 10_000 });

    fs.unlinkSync(pdfPath);
  });

  test('clicking View opens the document viewer', async ({ authedPage: page }) => {
    // Upload first
    const pdfPath = makeTempPdf();

    await page.goto('/documents/upload');
    await page.locator('input[type="file"]').setInputFiles(pdfPath);
    const catSelect = page.getByLabel(/category/i);
    if (await catSelect.count() > 0) await catSelect.selectOption('LAB_REPORT');
    await page.getByRole('button', { name: /upload|submit/i }).click();
    await page.waitForURL(/\/documents/, { timeout: 20_000 });

    // Click the first View link
    const viewLink = page.getByRole('link', { name: /view/i }).first();
    await viewLink.click();

    // Should land on the document viewer route
    await expect(page).toHaveURL(/\/documents\/.+\/view/, { timeout: 10_000 });

    // Viewer should contain a download / open link (presigned URL)
    await expect(
      page.getByRole('link', { name: /download|open|view/i })
    ).toBeVisible({ timeout: 10_000 });

    fs.unlinkSync(pdfPath);
  });

  test('document list is empty message shown when no documents', async ({ authedPage: page }) => {
    // A freshly registered user has no documents yet
    await page.goto('/documents');

    // Either an empty-state message or a table with 0 rows
    const isEmpty = await page.getByText(/no documents/i).isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasTable = await page.locator('table tbody tr').count() === 0;

    expect(isEmpty || hasTable).toBeTruthy();
  });
});
