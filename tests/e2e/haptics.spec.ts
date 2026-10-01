import { test, expect, type Page } from '@playwright/test';

async function openWithVibration(
  page: Page,
  result: 'ok' | 'blocked' | 'throws' | 'unsupported',
) {
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
  await page.addInitScript((result) => {
    (window as any).__vibrations = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value:
        result === 'unsupported'
          ? undefined
          : (ms: number) => {
              (window as any).__vibrations.push(ms);
              if (result === 'throws') throw new Error('Vibration rejected');
              return result === 'ok';
            },
    });
  }, result);
  await page.goto('/');
}

test('vibration test and both modes use distinct durations without changing saved preference', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWithVibration(page, 'ok');
  const toggle = page.locator('#haptics-toggle');
  await toggle.uncheck();
  await page.locator('#btn-haptic-test').click();
  await expect(page.locator('#haptic-status')).toContainText(
    '진동을 요청했어요',
  );
  await expect(toggle).not.toBeChecked();
  const preferences = await page.locator('.preferences').boundingBox();
  const hapticRow = await page.locator('.switch-row').first().boundingBox();
  const testRow = await page.locator('.haptic-test-row').boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(hapticRow!.width).toBeGreaterThan(preferences!.width * 0.9);
  expect(testRow!.width).toBeGreaterThan(preferences!.width * 0.9);
  expect(testRow!.y).toBeGreaterThan(hapticRow!.y);
  expect(toggleBox!.width).toBe(32);
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([
    150,
  ]);
  await page.locator('#btn-start').click();
  await page.locator('#btn-tap').click();
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([
    150,
  ]);
  await toggle.check();
  await page.waitForTimeout(100);
  await page.locator('#btn-tap').click();
  expect(await page.evaluate(() => (window as any).__vibrations)).toContain(50);
  await page.locator('#tab-squishy').click();
  await page.waitForTimeout(100);
  await page.locator('#btn-tap').click();
  expect(await page.evaluate(() => (window as any).__vibrations)).toContain(40);
  await toggle.uncheck();
  expect(await page.evaluate(() => (window as any).__vibrations.at(-1))).toBe(
    0,
  );
  await page.reload();
  await expect(toggle).not.toBeChecked();
});

for (const result of ['blocked', 'throws'] as const) {
  test(`vibration ${result} is explained and wax interaction remains usable`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openWithVibration(page, result);
    await page.locator('#btn-haptic-test').click();
    await expect(page.locator('#haptic-status')).toContainText(
      '진동 요청을 허용하지',
    );
    await page.locator('#btn-start').click();
    await page.locator('#btn-tap').click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__waxDebug.physics.particles.length,
        ),
      )
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('unsupported browsers show disabled vibration controls', async ({
  page,
}) => {
  await openWithVibration(page, 'unsupported');
  await expect(page.locator('#haptics-toggle')).toBeDisabled();
  await expect(page.locator('#haptics-toggle')).not.toBeChecked();
  await expect(page.locator('#btn-haptic-test')).toBeDisabled();
  await expect(page.locator('#haptic-support')).toContainText(
    '브라우저는 진동을 지원하지',
  );
});
