import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
async function importSample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import library data', exact: true }).click();
  await page.getByRole('button', { name: 'Try the sample library' }).click();
  await expect(page.getByText(/Importing replaces your entire library/)).toBeVisible();
  await page.getByRole('button', { name: 'Replace library and import this file' }).click();
  await expect(page.getByText('IMPORTED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to home' }).click();
}
test('import, offline reader, Drill, restart, credential-free re-export and cancelled replace', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await importSample(page);
  await page.getByRole('button', { name: 'Open subject Cellular Biology' }).click();
  await expect(page.getByText('Alkanes', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Cellular respiration/ }).click();
  const reader = page.frameLocator('iframe[title="Note reader"]');
  await expect(reader.getByText(/ATP is produced/)).toBeVisible();
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts');
  expect(await page.locator('meta[data-reader-csp]').count()).toBe(0);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(reader.getByText(/ATP is produced/)).toBeVisible();
  await expect(reader.getByText(/ATP is produced/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to subject' }).click();
  await page.getByRole('button', { name: /Respiration recall/ }).click();
  await page.getByRole('button', { name: 'Show answer', exact: true }).click();
  await expect(page.getByText('In the cytosol.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rate mastered', exact: true }).click();
  await expect(page.getByText('100% · 1/1 mastered', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open subject Cellular Biology' }).click();
  await expect(page.getByText('Respiration recall').first()).toBeVisible();
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export library', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile((await download.path())!, 'utf8'));
  expect(exported.format).toBe('temari-portable');
  expect(exported.data.attempts[0].overallScore).toBe(100);
  expect(exported.data.quizzes[0].timesPracticed).toBe(1);
  expect(exported.data.tasks).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toMatch(/apiKey|providerKeys/);
  await page.getByRole('button', { name: 'Import library data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Pick an export file' }).click();
  await (await chooser).setFiles('fixtures/mobile/portable-empty.json');
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open subject Cellular Biology' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('browser key is memory-only; readiness and real Explain bridge work outside reader CSP', async ({ page }) => {
  const requests: { method: string; body: string | null }[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    requests.push({ method: route.request().method(), body: route.request().postData() });
    await route.fulfill({ json: route.request().method() === 'GET'
      ? { supportedGenerationMethods: ['generateContent'] }
      : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ATP carries energy in cells.' }] } }] } });
  });
  await importSample(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Gemini API key').fill('fake-test-key');
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await expect(page.getByText('KEY SAVED · ENTER A NEW KEY TO ROTATE')).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('fake-test-key');
  await page.getByRole('button', { name: 'Test connection', exact: true }).click();
  await expect(page.getByText('Connected to the saved model. Generation quota has not been tested.')).toBeVisible();
  await page.getByRole('button', { name: '← Library', exact: true }).click();
  await page.getByRole('button', { name: 'Open subject Cellular Biology' }).click();
  await page.getByRole('button', { name: /Cellular respiration/ }).click();
  const frame = page.frameLocator('iframe[title="Note reader"]');
  const paragraph = frame.getByText(/ATP is produced/);
  await expect(paragraph).toBeVisible();
  await paragraph.evaluate(element => {
    const range = document.createRange(); range.setStart(element.firstChild!, 0); range.setEnd(element.firstChild!, 3);
    const selection = document.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  page.once('dialog', dialog => dialog.accept());
  await frame.getByRole('button', { name: 'Explain term', exact: true }).click();
  await expect(page.getByText('ATP carries energy in cells.', { exact: true })).toBeVisible();
  expect(requests.filter(request => request.method === 'POST')).toHaveLength(1);
  expect(requests.every(request => !request.body?.includes('fake-test-key'))).toBe(true);
  await page.goto('/settings'); // actual document reload clears the in-memory key
  await expect(page.getByText('NO KEY SAVED', { exact: true })).toBeVisible();
});

test('PDF picker requires explicit send, extracts Material, exports text and redacted diagnostics', async ({ page }) => {
  let paidRequests = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    if (route.request().method() === 'POST') {
      paidRequests++;
      expect(route.request().postDataJSON().contents[0].parts[0].inlineData.mimeType).toBe('application/pdf');
    }
    await route.fulfill({ json: route.request().method() === 'GET' ? { supportedGenerationMethods: ['generateContent'] }
      : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Photosynthesis converts light energy.' }] } }] } });
  });
  await page.goto('/settings');
  await page.getByLabel('Gemini API key').fill('fake-pdf-key');
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await expect(page.getByText('KEY SAVED · ENTER A NEW KEY TO ROTATE')).toBeVisible();
  await page.getByRole('button', { name: '← Library', exact: true }).click();
  await page.getByRole('button', { name: 'Extract a PDF', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a PDF', exact: true }).click();
  await (await chooser).setFiles('fixtures/mobile/material-small.pdf');
  await expect(page.getByText(/Send this entire PDF/)).toBeVisible();
  expect(paidRequests).toBe(0);
  await page.getByRole('button', { name: 'Send PDF and extract', exact: true }).click();
  await expect(page.getByLabel('Extracted Material')).toHaveValue('Photosynthesis converts light energy.');
  expect(paidRequests).toBe(1);
  const textDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Material as text', exact: true }).click();
  expect(await fs.readFile((await (await textDownload).path())!, 'utf8')).toBe('Photosynthesis converts light energy.');
  await page.getByRole('button', { name: '← Library', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const diagnosticDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export diagnostic report', exact: true }).click();
  const report = await fs.readFile((await (await diagnosticDownload).path())!, 'utf8');
  expect(report).toContain('temari-diagnostics-v1');
  expect(report).not.toMatch(/fake-pdf-key|Photosynthesis|material-small/);
});

test('invalid imports and a denied Explain leave local data and keys untouched', async ({ page }) => {
  await importSample(page);
  await page.getByRole('button', { name: 'Import library data', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Pick an export file', exact: true }).click();
  await (await chooser).setFiles('fixtures/mobile/portable-invalid-reference.json');
  await expect(page.getByText('This file is not a valid export. Nothing was changed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace library and import this file' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to home', exact: true }).click();
  await page.getByRole('button', { name: 'Open subject Cellular Biology' }).click();
  await page.getByRole('button', { name: /Cellular respiration/ }).click();
  let network = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => { network++; return route.abort(); });
  const reader = page.frameLocator('iframe[title="Note reader"]');
  await reader.getByText(/ATP is produced/).evaluate(element => {
    const range = document.createRange(); range.setStart(element.firstChild!, 0); range.setEnd(element.firstChild!, 3);
    document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  page.once('dialog', dialog => dialog.dismiss());
  await reader.getByRole('button', { name: 'Explain term', exact: true }).click();
  await expect(page.getByText('GEMINI · WORKING', { exact: true })).toHaveCount(0);
  expect(network).toBe(0);
});
