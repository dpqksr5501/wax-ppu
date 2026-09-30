const KEY = 'waxppu:settings:v2';
export const defaults = {
  volume: 80,
  mode: 'wax',
  character: 'cat_paw',
  feel: 'original',
  sound: 'original',
  haptics: true,
  reducedMotion: false,
};
export function safeRead(key, fallback, storage) {
  try {
    return (
      JSON.parse((storage ?? globalThis.localStorage).getItem(key) || 'null') ??
      fallback
    );
  } catch {
    return fallback;
  }
}
export function safeWrite(key, value, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function loadSettings(storage) {
  const data = safeRead(KEY, {}, storage);
  const value = { ...defaults };
  if (!data || typeof data !== 'object') return value;
  if (Number.isFinite(data.volume))
    value.volume = Math.max(0, Math.min(100, data.volume));
  for (const [key, choices] of Object.entries({
    mode: ['wax', 'squishy'],
    character: ['cat_paw', 'mochi_rabbit'],
    feel: ['original', 'soft', 'bouncy'],
    sound: ['original', 'crispy', 'thick', 'soft'],
  })) {
    if (choices.includes(data[key])) value[key] = data[key];
  }
  for (const key of ['haptics', 'reducedMotion'])
    if (typeof data[key] === 'boolean') value[key] = data[key];
  return value;
}
export function saveSettings(settings) {
  return safeWrite(KEY, settings);
}
