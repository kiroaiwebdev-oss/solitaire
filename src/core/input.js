/**
 * Unified input handling: pointer events (mouse + touch) and keyboard.
 */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0, down: false, justPressed: false, justReleased: false };
    this.drag = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    this.keys = {};
    this.keysJustPressed = {};
    this.listeners = [];

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const coords = this._getCanvasCoords(e);
    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    this.pointer.down = true;
    this.pointer.justPressed = true;
    this.drag.active = true;
    this.drag.startX = coords.x;
    this.drag.startY = coords.y;
    this.drag.dx = 0;
    this.drag.dy = 0;
    this._emit('pointerdown', coords);
  }

  _onPointerMove(e) {
    e.preventDefault();
    const coords = this._getCanvasCoords(e);
    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    if (this.drag.active) {
      this.drag.dx = coords.x - this.drag.startX;
      this.drag.dy = coords.y - this.drag.startY;
    }
    this._emit('pointermove', coords);
  }

  _onPointerUp(e) {
    e.preventDefault();
    const coords = this._getCanvasCoords(e);
    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    this.pointer.down = false;
    this.pointer.justReleased = true;
    this.drag.active = false;
    this._emit('pointerup', coords);
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    this.keysJustPressed[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  on(event, handler) {
    this.listeners.push({ event, handler });
  }

  off(event, handler) {
    this.listeners = this.listeners.filter(
      l => !(l.event === event && l.handler === handler)
    );
  }

  _emit(event, data) {
    for (const l of this.listeners) {
      if (l.event === event) l.handler(data);
    }
  }

  endFrame() {
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
    this.keysJustPressed = {};
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }
}
