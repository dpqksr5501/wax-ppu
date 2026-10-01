import { test, expect } from '@playwright/test';
test('production shell reloads offline and local guestbook remains usable', async ({
  page,
  context,
}) => {
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.locator('#btn-start').click();
  await page.locator('#simulator-canvas').click();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btn-start')).toBeVisible();
  await page.locator('#btn-start').click();
  await page.locator('#tab-squishy').click();
  await expect(page.locator('#start-overlay')).toBeHidden();
  await page.locator('#simulator-canvas').click();
  await page.locator('#gb-nickname').fill('오프라인');
  await page.locator('#gb-message').fill('내 기기에만 기록해요');
  await page.locator('#gb-save-local').click();
  await expect(page.locator('#guestbook-list')).toContainText(
    '내 기기에만 기록해요',
  );
  await expect(page.locator('#gb-status')).toContainText(
    '다른 사람에게 공유되지는 않아요',
  );
});
