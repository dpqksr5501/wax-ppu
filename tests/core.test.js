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
import { deformPoint } from '../src/simulations/deformation.js';
import { FEELS, CONFIG } from '../src/config.js';

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

test('contact flattens vertically, pushes its sides out and leaves distant material still', () => {
  const out = {};
  deformPoint(30, 0, 0, 0, 1, out);
  assert.ok(out.x > 36);
  deformPoint(-30, 0, 0, 0, 1, out);
  assert.ok(out.x < -36);
  deformPoint(0, 30, 0, 0, 1, out);
  const bottom = out.y;
  deformPoint(0, -30, 0, 0, 1, out);
  assert.ok(bottom - out.y < 60);
  assert.deepEqual(deformPoint(100, 20, 0, 0, 1, out), { x: 100, y: 20 });
  assert.deepEqual(deformPoint(30, 20, 0, 0, 0, out), { x: 30, y: 20 });
});

test('all feels keep a local press while held, then fully restore and rest', () => {
  for (const feel of Object.keys(FEELS)) {
    const physics = engine();
    physics.setMode('squishy');
    physics.setFeel(feel);
    physics.handleSquishyDown(290, 285);
    for (let i = 0; i < 180; i++) physics.update(1);
    assert.ok(physics.squishyObj.pressure > 0.8);
    assert.equal(physics.squishyObj.isPressed, true);
    assert.equal(physics.isActive(), false);
    physics.handleSquishyMove(335, 300);
    assert.equal(physics.isActive(), true);
    assert.ok(physics.squishyObj.targetPressure > 0.8);
    physics.handleSquishyUp();
    for (let i = 0; i < 240; i++) physics.update(1);
    assert.equal(physics.isActive(), false);
    assert.equal(physics.squishyObj.pressure, 0);
    assert.equal(physics.squishyObj.scaleX, 1);
    assert.equal(physics.squishyObj.offsetX, 0);
  }
});

test('rapid squishy presses stay bounded and mode changes clear the contact', () => {
  const physics = engine();
  physics.setMode('squishy');
  for (let i = 0; i < 1000; i++) {
    physics.handleSquishyDown(280, 270);
    physics.update(1);
    physics.handleSquishyUp();
  }
  assert.ok(physics.squishyParticles.length <= CONFIG.mochi.maxParticles);
  assert.ok(physics.squishyObj.pressure <= 1.3);
  for (let i = 0; i < 240; i++) physics.update(1);
  assert.equal(physics.isActive(), false);
  physics.handleSquishyDown(260, 260);
  physics.setMode('wax');
  physics.setMode('squishy');
  assert.equal(physics.squishyObj.pressure, 0);
  assert.equal(physics.squishyObj.isPressed, false);
});

test('sweeping follows the pointer, stays on the edge outside, and ignores hover after release', () => {
  const physics = engine();
  physics.setMode('squishy');
  physics.handleSquishyDown(230, 260);
  for (let i = 0; i < 120; i++) physics.update(1);
  const initialContact = physics.squishyObj.pressX;
  physics.handleSquishyMove(335, 290);
  for (let i = 0; i < 180; i++) physics.update(1);
  const sq = physics.squishyObj;
  assert.ok(sq.pressX > initialContact + 60);
  const c = Math.cos(sq.rotation),
    s = Math.sin(sq.rotation);
  const contactX =
    sq.x + sq.offsetX + sq.pressX * sq.scaleX * c - sq.pressY * sq.scaleY * s;
  const contactY =
    sq.y + sq.offsetY + sq.pressX * sq.scaleX * s + sq.pressY * sq.scaleY * c;
  assert.ok(Math.hypot(contactX - 335, contactY - 290) < 0.01);
  assert.ok(Math.abs(sq.offsetX) < 25);
  assert.ok(sq.scaleX < 1.08);
  physics.handleSquishyMove(1600, -1200);
  for (let i = 0; i < 180; i++) physics.update(1);
  assert.ok(Math.hypot(sq.pressX, sq.pressY) <= sq.baseRadius + 0.01);
  physics.handleSquishyUp();
  const contact = { x: sq.pressX, y: sq.pressY };
  assert.equal(physics.handleSquishyMove(220, 300), 'none');
  assert.deepEqual({ x: sq.pressX, y: sq.pressY }, contact);
  for (let i = 0; i < 240; i++) physics.update(1);
  assert.equal(physics.isActive(), false);
  assert.equal(sq.pressure, 0);
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
