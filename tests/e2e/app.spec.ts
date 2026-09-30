import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/firestore\.googleapis\.com/, (route) => route.abort());
  await page.goto('/');
});
test('start, both simulations, settings and focus mode work without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('#btn-start').click();
  await expect(page.locator('#start-overlay')).toBeHidden();
  await page.locator('#btn-tap').click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__waxDebug.physics.particles.length),
    )
    .toBeGreaterThan(0);
  await page.locator('#tab-squishy').click();
  await page.locator('#feel-select').selectOption('soft');
  await page.locator('[data-char=mochi_rabbit]').click();
  await page.locator('#sound-select').selectOption('soft');
  await page.locator('#btn-mute').click();
  await page.locator('#btn-focus').click();
  await expect(page.locator('.controls')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.controls')).toBeVisible();
  await page.reload();
  await expect(page.locator('#feel-select')).toHaveValue('soft');
  await expect(page.locator('[data-char=mochi_rabbit]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#volume-slider')).toHaveValue('0');
  expect(errors).toEqual([]);
});
test('local guestbook counters, escaping, cooldown and persistence', async ({
  page,
}) => {
  await page.locator('#gb-nickname').fill('테스트');
  await page.locator('#gb-message').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#gb-count')).toHaveText(
    `${'<img src=x onerror=alert(1)>'.length} / 100`,
  );
  await page.locator('#gb-save-local').click();
  await expect(page.locator('#guestbook-list')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
  await expect(page.locator('#guestbook-list img')).toHaveCount(0);
  await expect(page.locator('#btn-submit-gb')).toBeDisabled();
  await expect(page.locator('#gb-status')).toContainText(
    '다른 사람에게 공유되지는 않아요',
  );
  await page.reload();
  await expect(page.locator('#guestbook-list')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
  await expect(page.locator('#btn-submit-gb')).toBeDisabled();
});
test('mobile DPR, no overflow, active-touch identity and cancel recovery', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#btn-start').click();
  await page.locator('#tab-squishy').click();
  const size = await page
    .locator('canvas')
    .evaluate((canvas: HTMLCanvasElement) => ({
      pixels: canvas.width,
      width: canvas.getBoundingClientRect().width,
    }));
  expect(size.pixels).toBe(Math.round(size.width * 2));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Use real browser Touch objects to verify identifier tracking, without touching a live DB.
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    const active = new Touch({
      identifier: 7,
      target: canvas,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    });
    const other = new Touch({
      identifier: 8,
      target: canvas,
      clientX: r.left + 3,
      clientY: r.top + 3,
    });
    canvas.dispatchEvent(
      new TouchEvent('touchstart', {
        changedTouches: [active],
        touches: [active],
        bubbles: true,
        cancelable: true,
      }),
    );
    const pressed = (window as any).__waxDebug.physics.squishyObj.isPressed;
    window.dispatchEvent(
      new TouchEvent('touchend', {
        changedTouches: [other],
        touches: [active],
      }),
    );
    const stillPressed = (window as any).__waxDebug.physics.squishyObj
      .isPressed;
    window.dispatchEvent(
      new TouchEvent('touchcancel', { changedTouches: [active], touches: [] }),
    );
    return {
      pressed,
      stillPressed,
      released: !(window as any).__waxDebug.physics.squishyObj.isPressed,
    };
  });
  expect(result).toEqual({ pressed: true, stillPressed: true, released: true });
  const session = await context.newCDPSession(page);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  let rect = (await page.locator('canvas').boundingBox())!;
  const beforeGutter = await page.evaluate(() => scrollY);
  const x = rect.x + 5,
    y = rect.y + rect.height * 0.8;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 5; step++)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - step * 35 }],
    });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(beforeGutter);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  rect = (await page.locator('canvas').boundingBox())!;
  const centerX = rect.x + rect.width / 2,
    centerY = rect.y + rect.height / 2;
  const beforeObject = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: centerY }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: centerX, y: centerY - 70 }],
  });
  expect(await page.evaluate(() => scrollY)).toBe(beforeObject);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__waxDebug.physics.squishyObj.isPressed,
      ),
    )
    .toBe(true);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__waxDebug.physics.squishyObj.isPressed,
      ),
    )
    .toBe(false);
  await context.close();
});
test('single failed image and audio requests do not prevent interaction', async ({
  page,
}) => {
  await page.route('**/Cracked_Wax8.*', (route) => route.abort());
  await page.route('**/*.m4a', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.reload();
  await page.locator('#btn-start').click();
  await page.locator('#btn-tap').click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__waxDebug.physics.assetFailures.length,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__waxDebug.physics.customImages.wax?.naturalWidth ||
          0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(page.locator('#start-overlay')).toBeHidden();
});
