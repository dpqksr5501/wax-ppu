import { CONFIG } from '../config.js';
export function validateEntry(nickname, message) {
  if (typeof nickname !== 'string' || typeof message !== 'string') return null;
  nickname = nickname.trim();
  message = message.trim();
  if (
    !nickname ||
    !message ||
    nickname.length > CONFIG.guestbook.nicknameMax ||
    message.length > CONFIG.guestbook.messageMax
  )
    return null;
  return { nickname, message };
}
export function normalizeEntry(value, id) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.nickname !== 'string' || typeof value.message !== 'string')
    return null;
  // Older public records may predate current input limits. Keep them visible,
  // while bounding display work for untrusted oversized values.
  const entry = {
    nickname: value.nickname.trim().slice(0, 80),
    message: value.message.trim().slice(0, 2000),
  };
  if (!entry.nickname || !entry.message) return null;
  let millis = null;
  try {
    millis =
      typeof value.timestamp?.toMillis === 'function'
        ? value.timestamp.toMillis()
        : typeof value.timestamp === 'number'
          ? value.timestamp
          : Date.parse(value.timestamp);
  } catch {
    /* invalid third-party data */
  }
  return {
    ...entry,
    id: String(id),
    timestamp:
      Number.isFinite(millis) && Number.isFinite(new Date(millis).getTime())
        ? millis
        : null,
    pending: Boolean(value.pending),
    local: Boolean(value.local),
  };
}
export function mergeEntries(...lists) {
  const byId = new Map();
  for (const list of lists) for (const entry of list) byId.set(entry.id, entry);
  return [...byId.values()].sort(
    (a, b) =>
      (b.timestamp ?? Infinity) - (a.timestamp ?? Infinity) ||
      b.id.localeCompare(a.id),
  );
}
