/**
 * Game loop using requestAnimationFrame with clamped delta time.
 */

export class GameLoop {
  constructor() {
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.frameId = null;
    this.updateFn = null;
    this.renderFn = null;
    this.maxDt = 0.05; // clamp dt to 50ms max
  }

  start(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this._tick = this._tick.bind(this);
    this.frameId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
    }
  }

  _tick(now) {
    if (!this.running) return;

    this.frameId = requestAnimationFrame(this._tick);

    if (this.paused) {
      this.lastTime = now;
      return;
    }

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamp dt to prevent spiral of death
    if (dt > this.maxDt) dt = this.maxDt;
    if (dt < 0) dt = 0;

    if (this.updateFn) this.updateFn(dt);
    if (this.renderFn) this.renderFn(dt);
  }
}
