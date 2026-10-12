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
  await expect(page.getByRole('button', { name: '한 번 누르기' })).toHaveCount(
    0,
  );
  await expect(page.locator('#simulator-canvas')).toBeFocused();
  await page.locator('#simulator-canvas').press('Space');
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
    type: 'touchCancel',
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(beforeGutter);
  // Finish the gutter's native momentum before testing a separate object gesture.
  await page.evaluate(async () => {
    let previous = scrollY,
      stable = 0;
    for (let frame = 0; frame < 240 && stable < 12; frame++) {
      await new Promise(requestAnimationFrame);
      stable = scrollY === previous ? stable + 1 : 0;
      previous = scrollY;
    }
  });
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  rect = (await page.locator('canvas').boundingBox())!;
  const centerX = rect.x + rect.width / 2,
    centerY = rect.y + rect.height / 2;
  const beforeObject = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: centerY }],
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__waxDebug.physics.squishyObj.isPressed,
      ),
    )
    .toBe(true);
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
  await page.locator('#simulator-canvas').click();
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

test('mouse holds a local press on both toys and release restores an idle scene', async ({
  page,
}) => {
  await page.locator('#btn-start').click();
  await page.locator('#tab-squishy').click();
  await page.evaluate(() => (window as any).__waxDebug.physics.squishyLoading);
  for (const character of ['cat_paw', 'mochi_rabbit']) {
    await page.locator(`[data-char=${character}]`).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__waxDebug.loop.id))
      .toBeNull();
    await page.locator('canvas').scrollIntoViewIfNeeded();
    const rect = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(
      rect.x + (rect.width * 292) / 520,
      rect.y + (rect.height * 292) / 520,
    );
    await page.mouse.down();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__waxDebug.physics.squishyObj.pressure,
        ),
      )
      .toBeGreaterThan(0.8);
    await expect
      .poll(() => page.evaluate(() => (window as any).__waxDebug.loop.id))
      .toBeNull();
    expect(
      await page.evaluate(
        () => (window as any).__waxDebug.physics.squishyObj.isPressed,
      ),
    ).toBe(true);
    // A resting, held scene must still wake and restore on pointer release.
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__waxDebug.physics.squishyObj.pressure,
        ),
      )
      .toBe(0);
    await expect
      .poll(() => page.evaluate(() => (window as any).__waxDebug.loop.id))
      .toBeNull();
    expect(
      await page.evaluate(
        () => (window as any).__waxDebug.physics.squishyObj.scaleX,
      ),
    ).toBe(1);
  }
});

test('particle animation reuses rasterized symbols and shard textures', async ({
  page,
}) => {
  await page.locator('#btn-start').click();
  const result = await page.evaluate(async () => {
    const { physics, loop } = (window as any).__waxDebug;
    loop.stop();
    await physics.waxLoading;
    await physics._loadSquishyImages();
    const ctx = document.querySelector('canvas')!.getContext('2d')!;
    const originalText = CanvasRenderingContext2D.prototype.fillText;
    const originalCreate = document.createElement.bind(document);
    let textDraws = 0,
      canvasAllocations = 0;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof originalText>
    ) {
      textDraws++;
      return originalText.apply(this, args);
    };
    document.createElement = ((...args: Parameters<typeof originalCreate>) => {
      if (args[0] === 'canvas') canvasAllocations++;
      return originalCreate(...args);
    }) as typeof document.createElement;
    const results = [];
    try {
      for (const mode of ['squishy', 'wax']) {
        physics.setMode(mode);
        physics.handleClick(280, 270);
        physics.draw(ctx);
        const before = { textDraws, canvasAllocations };
        for (let i = 0; i < 15; i++) {
          physics.update(1);
          physics.draw(ctx);
        }
        results.push({
          mode,
          textDraws: textDraws - before.textDraws,
          canvasAllocations: canvasAllocations - before.canvasAllocations,
        });
      }
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalText;
      document.createElement = originalCreate;
    }
    return results;
  });
  expect(result).toEqual([
    { mode: 'squishy', textDraws: 0, canvasAllocations: 0 },
    { mode: 'wax', textDraws: 0, canvasAllocations: 0 },
  ]);
});

test('sweeping plays gentle spaced sounds only while moving with the button held', async ({
  page,
}) => {
  await page.locator('#btn-start').click();
  await page.locator('#tab-squishy').click();
  await page.evaluate(() => (window as any).__waxDebug.physics.squishyLoading);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.clock.install();
  await page.evaluate(() => {
    const audio = (window as any).__waxDebug.audio;
    const original = audio.play.bind(audio);
    (window as any).__soundCalls = [];
    audio.play = (mode: string, intensity: number) => {
      (window as any).__soundCalls.push({
        mode,
        intensity,
        time: performance.now(),
      });
      original(mode, intensity);
    };
  });
  const rect = (await page.locator('canvas').boundingBox())!;
  const move = (x: number) =>
    page.mouse.move(rect.x + (x * rect.width) / 520, rect.y + rect.height / 2);
  const calls = () => page.evaluate(() => (window as any).__soundCalls);
  await move(240);
  await page.mouse.down();
  await page.clock.runFor(160);
  await move(244); // Small cursor jitter does not retrigger the sound.
  expect(await calls()).toHaveLength(1);
  await move(275);
  expect(await calls()).toHaveLength(2);
  await move(300); // A fast sweep still respects the sound interval.
  expect(await calls()).toHaveLength(2);
  await page.clock.runFor(160);
  await move(325);
  expect(await calls()).toHaveLength(3);
  await page.clock.runFor(500); // Holding still is silent.
  expect(await calls()).toHaveLength(3);
  await page.mouse.up();
  await move(260);
  await page.clock.runFor(1000);
  const sounds = await calls();
  expect(sounds.map((sound: any) => sound.intensity)).toEqual([1.05, 0.7, 0.7]);
  expect(sounds.every((sound: any) => sound.mode === 'squishy')).toBe(true);
  expect(sounds[2].time - sounds[1].time).toBeGreaterThanOrEqual(140);
  expect(
    await page.evaluate(
      () => (window as any).__waxDebug.physics.squishyObj.pressure,
    ),
  ).toBe(0);
});
