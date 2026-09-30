import { CONFIG } from '../config.js';
export function logicalPoint(clientX, clientY, rect, out) {
  if (!(rect.width > 0 && rect.height > 0)) return false;
  out.x = ((clientX - rect.left) * CONFIG.view.width) / rect.width;
  out.y = ((clientY - rect.top) * CONFIG.view.height) / rect.height;
  return true;
}
export function setupCanvas(canvas, draw) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.');
  let query;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxDpr);
    const w = Math.max(1, Math.round(rect.width * dpr)),
      h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(w / CONFIG.view.width, 0, 0, h / CONFIG.view.height, 0, 0);
    draw(ctx);
  };
  const watchDpr = () => {
    query?.removeEventListener('change', watchDpr);
    query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', watchDpr, { once: true });
    resize();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  watchDpr();
  return {
    ctx,
    resize,
    dispose() {
      observer.disconnect();
      query?.removeEventListener('change', watchDpr);
      window.removeEventListener('resize', resize);
    },
  };
}
