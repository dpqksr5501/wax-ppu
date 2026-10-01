import { CONFIG } from '../config.js';

// An accepted request cannot confirm that the device actually vibrated.
export function createHaptics(
  nav = globalThis.navigator,
  doc = globalThis.document,
  now = () => performance.now(),
) {
  let nextPulse = -Infinity;
  let requested = false;
  const available = typeof nav?.vibrate === 'function';
  return {
    available,
    pulse(duration, force = false) {
      if (!available) return 'unsupported';
      if (doc?.hidden) return 'inactive';
      if (nav.userActivation?.hasBeenActive === false) return 'activation';
      const time = now();
      if (!force && time < nextPulse) return 'throttled';
      try {
        if (!nav.vibrate(duration)) return 'blocked';
        requested = true;
        nextPulse = time + Math.max(duration, CONFIG.haptics.intervalMs);
        return 'requested';
      } catch {
        return 'blocked';
      }
    },
    stop() {
      if (available && requested) {
        try {
          nav.vibrate(0);
        } catch {
          /* A rejected request must not break input. */
        }
      }
      requested = false;
      nextPulse = -Infinity;
    },
  };
}
