/**
 * Canvas2D renderer with resize/DPR handling, gradient helpers,
 * shadow utilities, rounded rect, text, circle, offscreen canvas pool.
 */

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // Offscreen canvas pool for caching
    this._canvasPool = [];
    this._poolMax = 20;

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  _onResize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width * this.dpr;
    this.height = rect.height * this.dpr;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get logicalWidth() {
    return this.width / this.dpr;
  }

  get logicalHeight() {
    return this.height / this.dpr;
  }

  // --- Clear ---

  clear(color = '#1a6b3c') {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  // --- Basic Drawing ---

  drawRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  drawRoundedRect(x, y, w, h, radius, fillColor, strokeColor, lineWidth = 1) {
    const ctx = this.ctx;
    this._roundedRectPath(ctx, x, y, w, h, radius);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  drawText(text, x, y, font, color, align = 'left', baseline = 'top') {
    const ctx = this.ctx;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
  }

  drawCircle(x, y, radius, color) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  // --- Gradient Helpers ---

  createLinearGradient(x1, y1, x2, y2, stops) {
    const grad = this.ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [offset, color] of stops) {
      grad.addColorStop(offset, color);
    }
    return grad;
  }

  createRadialGradient(cx1, cy1, r1, cx2, cy2, r2, stops) {
    const grad = this.ctx.createRadialGradient(cx1, cy1, r1, cx2, cy2, r2);
    for (const [offset, color] of stops) {
      grad.addColorStop(offset, color);
    }
    return grad;
  }

  drawGradientRect(x, y, w, h, gradient) {
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, w, h);
  }

  drawGradientRoundedRect(x, y, w, h, radius, gradient, strokeColor, lineWidth) {
    const ctx = this.ctx;
    this._roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = gradient;
    ctx.fill();
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  // --- Shadow Utilities ---

  setShadow(offsetX, offsetY, blur, color) {
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
    this.ctx.shadowBlur = blur;
    this.ctx.shadowColor = color;
  }

  clearShadow() {
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';
  }

  /**
   * Draw a shape with an elevation shadow (card-like effect).
   * @param {number} elevation - 0 to 1 representing how elevated the element is
   */
  drawElevationShadow(x, y, w, h, radius, elevation = 0.5) {
    const blur = 4 + elevation * 16;
    const offsetY = 2 + elevation * 8;
    const alpha = 0.1 + elevation * 0.3;
    this.setShadow(0, offsetY, blur, `rgba(0,0,0,${alpha})`);
    this._roundedRectPath(this.ctx, x, y, w, h, radius);
    this.ctx.fillStyle = 'rgba(0,0,0,0)';
    this.ctx.fill();
    this.clearShadow();
  }

  // --- Offscreen Canvas Pool ---

  /**
   * Get an offscreen canvas from the pool (or create one).
   * @param {number} width
   * @param {number} height
   * @returns {{ canvas: OffscreenCanvas|HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
   */
  getOffscreenCanvas(width, height) {
    // Try to reuse from pool
    for (let i = 0; i < this._canvasPool.length; i++) {
      const item = this._canvasPool[i];
      if (!item.inUse && item.canvas.width >= width && item.canvas.height >= height) {
        item.inUse = true;
        item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
        return { canvas: item.canvas, ctx: item.ctx, _poolIndex: i };
      }
    }

    // Create new
    let canvas;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    const idx = this._canvasPool.length;
    this._canvasPool.push({ canvas, ctx, inUse: true });
    return { canvas, ctx, _poolIndex: idx };
  }

  /**
   * Return an offscreen canvas to the pool.
   */
  releaseOffscreenCanvas(handle) {
    if (handle && handle._poolIndex !== undefined && this._canvasPool[handle._poolIndex]) {
      this._canvasPool[handle._poolIndex].inUse = false;
    }
  }

  // --- Transform Helpers ---

  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }

  setAlpha(alpha) {
    this.ctx.globalAlpha = alpha;
  }

  translate(x, y) {
    this.ctx.translate(x, y);
  }

  rotate(angle) {
    this.ctx.rotate(angle);
  }

  scale(sx, sy) {
    this.ctx.scale(sx, sy !== undefined ? sy : sx);
  }

  // --- Clip Helpers ---

  clipRoundedRect(x, y, w, h, radius) {
    this._roundedRectPath(this.ctx, x, y, w, h, radius);
    this.ctx.clip();
  }

  clipRect(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  // --- Utility ---

  _roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  measureText(text, font) {
    this.ctx.font = font;
    return this.ctx.measureText(text);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this._canvasPool = [];
  }
}
