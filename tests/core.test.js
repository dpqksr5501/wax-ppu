import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logicalPoint } from '../src/core/canvas.js';
import { FixedStepper } from '../src/core/loop.js';
import { loadSettings, safeRead, safeWrite } from '../src/core/settings.js';
import {
  validateEntry,
  normalizeEntry,
  mergeEntries,
} from '../src/guestbook/data.js';
import { WaxPhysicsEngine } from '../src/simulations/physics.js';
import { readyImage } from '../src/core/assets.js';

globalThis.Image = class {
  constructor() {
    this.complete = true;
    this.naturalWidth = 200;
  }
  set src(value) {
    queueMicrotask(() =>
      value.includes('Cracked_Wax8') ? this.onerror?.() : this.onload?.(),
    );
  }
};
const engine = () => new WaxPhysicsEngine({ width: 1560, height: 1560 });
test('DPR changes physical pixels without changing hit coordinates', () => {
  const point = {};
  assert.equal(
    logicalPoint(
      210,
      170,
      { left: 10, top: 20, width: 400, height: 300 },
      point,
    ),
    true,
  );
  assert.deepEqual(point, { x: 260, y: 260 });
  assert.equal(logicalPoint(0, 0, { width: 0, height: 0 }, point), false);
  const physics = engine();
  assert.equal(physics.width, 520);
  assert.equal(physics.hitTest(260, 260), true);
});
test('60Hz and 120Hz produce the same 60Hz spring trajectory', () => {
  function run(hz) {
    const physics = engine();
    physics.setMode('squishy');
    physics.handleSquishyDown(370, 260);
    const stepper = new FixedStepper(
      (dt) => physics.update(dt),
      () => {},
    );
    stepper.advance(0);
    for (let frame = 1; frame <= hz / 10; frame++)
      stepper.advance((frame * 1000) / hz);
    return physics.squishyObj.scaleX;
  }
  assert.ok(Math.abs(run(60) - run(120)) < 1e-10);
});
test('long frames are bounded and reset discards elapsed hidden time', () => {
  let steps = 0;
  const stepper = new FixedStepper(
    () => steps++,
    () => {},
  );
  stepper.advance(0);
  stepper.advance(10000);
  assert.equal(steps, 6);
  stepper.reset();
  stepper.advance(30000);
  assert.equal(steps, 6);
});
test('one missing texture does not block other loaded images', async () => {
  const physics = engine();
  await new Promise((resolve) => setImmediate(resolve));
  physics.setMode('squishy');
  await physics.squishyLoading;
  assert.equal(readyImage(physics.customImages.wax), true);
  assert.equal(readyImage(physics.customImages.cracked7), true);
  assert.equal(physics.customImages.cracked8, undefined);
  assert.equal(readyImage(physics.squishyImages.cat_paw), true);
  assert.ok(physics.assetFailures.includes('cracked8'));
});
test('shards retain their own texture and arrays compact in place', async () => {
  const physics = engine();
  await new Promise((resolve) => setImmediate(resolve));
  physics.currentWaxImage = 'cracked1';
  physics.spawnShards(260, 260, 4);
  const particles = physics.particles,
    texture = particles[0].texture;
  physics.currentWaxImage = 'cracked2';
  physics.update(1);
  assert.equal(physics.particles, particles);
  assert.equal(particles[0].texture, texture);
  for (let i = 0; i < 100; i++) physics.update(1);
  assert.equal(physics.particles.length, 0);
  assert.equal(physics.particles, particles);
});
test('particle limits remain bounded under sustained clicks', () => {
  const physics = engine();
  for (let i = 0; i < 1000; i++) physics.spawnShards(260, 260, 13);
  assert.equal(physics.particles.length, 300);
});
test('hit test follows deformed mochi and release clears pressing state', () => {
  const physics = engine();
  physics.setMode('squishy');
  physics.squishyObj.offsetX = 42;
  physics.squishyObj.scaleX = 0.7;
  assert.equal(physics.hitTest(302, 260), true);
  assert.equal(physics.hitTest(110, 260), false);
  physics.handleSquishyDown(302, 260);
  assert.equal(physics.squishyObj.isPressed, true);
  physics.handleSquishyUp();
  assert.equal(physics.squishyObj.isPressed, false);
  assert.equal(physics.squishyObj.pressPoint, null);
});
test('settings recover from malformed JSON and blocked localStorage', () => {
  const broken = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  };
  assert.equal(safeRead('x', 12, broken), 12);
  assert.equal(safeWrite('x', {}, broken), false);
  assert.equal(
    loadSettings({
      getItem() {
        return '{bad';
      },
    }).volume,
    80,
  );
  const settings = loadSettings({
    getItem() {
      return '{"volume":999,"mode":"bad","feel":"soft"}';
    },
  });
  assert.equal(settings.volume, 100);
  assert.equal(settings.mode, 'wax');
  assert.equal(settings.feel, 'soft');
});
test('guestbook rejects invalid field types/limits and normalizes timestamps', () => {
  assert.equal(validateEntry(12, 'hello'), null);
  assert.equal(validateEntry('a', 'x'.repeat(101)), null);
  assert.equal(normalizeEntry({ nickname: 'a', message: {} }, 'id'), null);
  assert.deepEqual(validateEntry(' a ', ' hello '), {
    nickname: 'a',
    message: 'hello',
  });
  assert.equal(
    normalizeEntry({ nickname: 'a', message: 'b', timestamp: 'wrong' }, 'id')
      .timestamp,
    null,
  );
  assert.equal(
    normalizeEntry({ nickname: 'a', message: 'b', timestamp: 1000 }, 'id')
      .timestamp,
    1000,
  );
});
test('live and historical rows merge by document ID with live values winning', () => {
  const rows = mergeEntries(
    [{ id: 'a', timestamp: 1, message: 'old' }],
    [
      { id: 'a', timestamp: 2, message: 'new' },
      { id: 'b', timestamp: 3 },
    ],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'b');
  assert.equal(rows[1].message, 'new');
});
test('older long nicknames remain readable without loosening new-write validation', () => {
  const legacy = {
    nickname: 'a'.repeat(20),
    message: '기존 기록',
    timestamp: 1000,
  };
  assert.equal(validateEntry(legacy.nickname, legacy.message), null);
  assert.equal(normalizeEntry(legacy, 'old').nickname, legacy.nickname);
});
