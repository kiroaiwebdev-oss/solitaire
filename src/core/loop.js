/**
 * Game loop using requestAnimationFrame with clamped delta time.
 * Includes FPS tracking and performance monitoring.
 */

export class GameLoop {
  constructor() {
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.frameId = null;
    this.updateFn = null;
    this.renderFn = null;
    this.maxDt = 0.05; // clamp dt to 50ms max (prevents spiral of death)

    // FPS tracking
    this.fps = 60;
    this.frameCount = 0;
    this.fpsAccumulator = 0;
    this.fpsUpdateInterval = 0.5; // update FPS display every 500ms
    this.frameTimes = [];
    this.maxFrameSamples = 60;

    // Performance stats
    this.updateTime = 0;
    this.renderTime = 0;
    this.totalFrameTime = 0;
  }

  /**
   * Start the game loop.
   * @param {(dt: number) => void} updateFn
   * @param {(dt: number) => void} renderFn
   */
  start(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fpsAccumulator = 0;
    this._tick = this._tick.bind(this);
    this.frameId = requestAnimationFrame(this._tick);
  }

  /**
   * Stop the game loop completely.
   */
  stop() {
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Pause the loop (update/render still called but dt is 0 equivalent).
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume from pause.
   */
  resume() {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
    }
  }

  /**
   * Get the current FPS.
   * @returns {number}
   */
  getFps() {
    return Math.round(this.fps);
  }

  /**
   * Get average frame time in ms.
   * @returns {number}
   */
  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Internal tick function - called each animation frame.
   */
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

    const frameStart = performance.now();

    // Update
    const updateStart = performance.now();
    if (this.updateFn) this.updateFn(dt);
    this.updateTime = performance.now() - updateStart;

    // Render
    const renderStart = performance.now();
    if (this.renderFn) this.renderFn(dt);
    this.renderTime = performance.now() - renderStart;

    this.totalFrameTime = performance.now() - frameStart;

    // Track frame times
    this.frameTimes.push(this.totalFrameTime);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    // FPS calculation
    this.frameCount++;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= this.fpsUpdateInterval) {
      this.fps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }
  }
}
