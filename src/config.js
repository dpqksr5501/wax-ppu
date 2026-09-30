export const CONFIG = Object.freeze({
  view: Object.freeze({ width: 520, height: 520, maxDpr: 2 }),
  timing: Object.freeze({ stepMs: 1000 / 60, maxFrameMs: 100, dragMs: 50 }),
  wax: Object.freeze({
    radius: 130,
    springK: 0.15,
    damping: 0.82,
    gravity: 14,
    maxParticles: 300,
  }),
  mochi: Object.freeze({
    radius: 150,
    springK: 0.22,
    damping: 0.74,
    maxPull: 65,
    maxParticles: 120,
  }),
  audio: Object.freeze({
    volume: 0.8,
    maxVoices: 12,
    timeoutMs: 8000,
    pitchMin: 0.96,
    pitchSpan: 0.08,
  }),
  guestbook: Object.freeze({
    recentLimit: 10,
    pageSize: 10,
    cooldownMs: 10000,
    maxLocal: 100,
    nicknameMax: 10,
    messageMax: 100,
  }),
});
export const FEELS = Object.freeze({
  original: {
    label: '오리지널',
    springK: 0.22,
    damping: 0.74,
    pull: 65,
    squeeze: 1,
  },
  soft: {
    label: '말랑말랑',
    springK: 0.14,
    damping: 0.78,
    pull: 80,
    squeeze: 1.12,
  },
  bouncy: {
    label: '탱글탱글',
    springK: 0.27,
    damping: 0.8,
    pull: 55,
    squeeze: 0.85,
  },
});
export const CRACKS = Object.freeze(
  Array.from({ length: 8 }, (_, i) => `cracked${i + 1}`),
);
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBb1lVkn_Ol4amr4bGzhmlYvn_rZ5qE5gE',
  authDomain: 'waxppu-cac47.firebaseapp.com',
  projectId: 'waxppu-cac47',
  storageBucket: 'waxppu-cac47.firebasestorage.app',
  messagingSenderId: '854443872433',
  appId: '1:854443872433:web:5c4fd6ed1efdd9081ed290',
};
