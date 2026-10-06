import { test, expect } from '@playwright/test';
test('demo catalog, details, favorites and episode selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo mode', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Big Buck Bunny' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Add to My List' }).click();
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'My List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Big Buck Bunny' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Open CineBox Player Lab' }).click();
  await page.getByRole('button', { name: 'Episode 2: Resume and navigation' }).click();
  await expect(page.getByText('Season 1 · Episode 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Video player')).toBeVisible();
});
test('validates API requests', async ({ request }) => {
  expect((await request.get('/api/media?action=streams')).status()).toBe(400);
  expect((await request.get('/api/media?action=details&id=not-real')).status()).toBe(404);
});
// This intentionally verifies UI wiring, not external CDN availability or video decoding.
