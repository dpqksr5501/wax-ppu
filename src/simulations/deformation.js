// Material coordinates: flatten the contact patch and push its soft rim outwards.
// Compact support leaves the rest of the toy still and avoids a global zoom effect.
export function deformPoint(x, y, pressX, pressY, pressure, out) {
  const dx = x - pressX;
  const dy = y - pressY;
  const distance = Math.hypot(dx, dy);
  const radius = 85;
  const t = Math.max(0, 1 - distance / radius);
  const falloff = t * t * (3 - 2 * t);
  const rim = Math.sin(Math.PI * Math.min(1, distance / radius)) * falloff;
  out.x = x + dx * pressure * (0.5 * falloff + 0.21 * rim);
  out.y = y + pressure * (dy * (-0.28 * falloff + 0.21 * rim) + 8 * falloff);
  return out;
}
