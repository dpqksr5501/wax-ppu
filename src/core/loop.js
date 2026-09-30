import { CONFIG } from '../config.js';
export class FixedStepper {
  constructor(update, draw) {
    this.update = update;
    this.draw = draw;
    this.previous = null;
    this.accumulator = 0;
  }
  reset() {
    this.previous = null;
    this.accumulator = 0;
  }
  advance(now) {
    const elapsed =
      this.previous === null ? 0 : Math.max(0, now - this.previous);
    this.previous = now;
    this.accumulator += Math.min(elapsed, CONFIG.timing.maxFrameMs);
    while (this.accumulator + 1e-7 >= CONFIG.timing.stepMs) {
      this.update(1);
      this.accumulator = Math.max(0, this.accumulator - CONFIG.timing.stepMs);
    }
    this.draw();
  }
}
export class SimulationLoop {
  constructor(update, draw, needsFrame) {
    this.stepper = new FixedStepper(update, draw);
    this.needsFrame = needsFrame;
    this.id = null;
    this.enabled = true;
    this.frame = (now) => {
      this.stepper.advance(now);
      if (this.enabled && this.needsFrame())
        this.id = requestAnimationFrame(this.frame);
      else {
        this.id = null;
        this.stepper.reset();
      }
    };
  }
  wake() {
    if (!this.enabled || this.id !== null) return;
    this.stepper.reset();
    this.id = requestAnimationFrame(this.frame);
  }
  stop() {
    if (this.id !== null) cancelAnimationFrame(this.id);
    this.id = null;
    this.stepper.reset();
  }
  setEnabled(value) {
    this.enabled = value;
    if (!value) this.stop();
    else this.wake();
  }
  dispose() {
    this.setEnabled(false);
  }
}
