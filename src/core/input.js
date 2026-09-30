import { logicalPoint } from './canvas.js';
// Touch Events retain circular hit testing and native scrolling in the canvas gutter.
// Mouse/pen use pointer capture; touch is deliberately excluded from pointer handlers.
export function bindInput(canvas, { hitTest, start, move, end }) {
  const abort = new AbortController();
  const signal = abort.signal;
  const point = { x: 0, y: 0 };
  let pointerId = null,
    touchId = null;
  const map = (event) =>
    logicalPoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      point,
    );
  const cancel = () => {
    const held = pointerId;
    pointerId = null;
    touchId = null;
    end();
    if (held !== null && canvas.hasPointerCapture(held))
      canvas.releasePointerCapture(held);
  };
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (
        event.pointerType === 'touch' ||
        event.button !== 0 ||
        pointerId !== null ||
        touchId !== null
      )
        return;
      if (!map(event) || !hitTest(point.x, point.y)) return;
      if (!start(point.x, point.y)) return;
      pointerId = event.pointerId;
      canvas.setPointerCapture(pointerId);
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== pointerId) return;
      if (!event.buttons) {
        cancel();
        return;
      }
      if (map(event)) move(point.x, point.y);
    },
    { signal },
  );
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(
      type,
      (event) => {
        if (event.pointerId === pointerId) cancel();
      },
      { signal },
    );
  }
  canvas.addEventListener(
    'touchstart',
    (event) => {
      if (touchId !== null || pointerId !== null) return;
      const touch = event.changedTouches[0];
      if (!touch || !map(touch) || !hitTest(point.x, point.y)) return;
      if (event.cancelable) event.preventDefault();
      if (start(point.x, point.y)) touchId = touch.identifier;
    },
    { passive: false, signal },
  );
  canvas.addEventListener(
    'touchmove',
    (event) => {
      if (touchId === null) return;
      const touch = Array.from(event.touches).find(
        (item) => item.identifier === touchId,
      );
      if (!touch) {
        cancel();
        return;
      }
      if (event.cancelable) event.preventDefault();
      if (map(touch)) move(point.x, point.y);
    },
    { passive: false, signal },
  );
  for (const type of ['touchend', 'touchcancel']) {
    window.addEventListener(
      type,
      (event) => {
        if (
          touchId !== null &&
          Array.from(event.changedTouches).some(
            (item) => item.identifier === touchId,
          )
        )
          cancel();
      },
      { signal },
    );
  }
  window.addEventListener('blur', cancel, { signal });
  window.addEventListener('pagehide', cancel, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) cancel();
    },
    { signal },
  );
  return {
    cancel,
    dispose() {
      cancel();
      abort.abort();
    },
  };
}
