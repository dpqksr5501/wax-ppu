import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHaptics } from '../src/core/haptics.js';

test('unavailable vibration API is reported without throwing', () => {
  const haptics = createHaptics({}, { hidden: false });
  assert.equal(haptics.available, false);
  assert.equal(haptics.pulse(50), 'unsupported');
  assert.doesNotThrow(() => haptics.stop());
});

test('user activation and page visibility gate vibration requests', () => {
  const calls = [];
  const nav = {
    userActivation: { hasBeenActive: false },
    vibrate(ms) {
      calls.push(ms);
      return true;
    },
  };
  const doc = { hidden: false };
  const haptics = createHaptics(nav, doc);
  assert.equal(haptics.pulse(50), 'activation');
  nav.userActivation.hasBeenActive = true;
  doc.hidden = true;
  assert.equal(haptics.pulse(50), 'inactive');
  assert.deepEqual(calls, []);
  doc.hidden = false;
  assert.equal(haptics.pulse(50), 'requested');
});

test('rejected or throwing vibration requests do not break interaction', () => {
  for (const vibrate of [
    () => false,
    () => {
      throw new Error('blocked');
    },
  ]) {
    const haptics = createHaptics({ vibrate }, { hidden: false });
    assert.equal(haptics.pulse(50), 'blocked');
    assert.doesNotThrow(() => haptics.stop());
  }
});

test('rapid interactions preserve pulses and cancellation resets the gate', () => {
  const calls = [];
  let time = 0;
  const haptics = createHaptics(
    {
      vibrate(ms) {
        calls.push(ms);
        return true;
      },
    },
    { hidden: false },
    () => time,
  );
  assert.equal(haptics.pulse(150, true), 'requested');
  time = 100;
  assert.equal(haptics.pulse(50), 'throttled');
  time = 150;
  assert.equal(haptics.pulse(40), 'requested');
  haptics.stop();
  assert.deepEqual(calls, [150, 40, 0]);
  assert.equal(haptics.pulse(50), 'requested');
});
