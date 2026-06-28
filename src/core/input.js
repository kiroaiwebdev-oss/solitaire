/**
 * Unified input handling: pointer events (mouse + touch), multi-touch,
 * double-tap detection, long-press detection, keyboard shortcuts,
 * gesture (swipe) detection, right-click context menu.
 */

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointer = { x: 0, y: 0, down: false, justPressed: false, justReleased: false };
    this.drag = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    this.keys = {};
    this.keysJustPressed = {};
    this.listeners = [];

    // Multi-touch tracking
    this.touches = new Map(); // pointerId -> { x, y, startX, startY, startTime }

    // Double-tap detection
    this._lastTapTime = 0;
    this._lastTapX = 0;
    this._lastTapY = 0;
    this._doubleTapWindow = 300; // ms
    this._doubleTapDistance = 30; // px
    this.doubleTapped = false;
    this.doubleTapX = 0;
    this.doubleTapY = 0;

    // Long-press detection
    this._longPressTimeout = null;
    this._longPressDuration = 500; // ms
    this.longPressed = false;
    this.longPressX = 0;
    this.longPressY = 0;

    // Swipe detection
    this._swipeThreshold = 50; // px
    this._swipeTimeLimit = 300; // ms
    this.swipe = null; // { direction: 'left'|'right'|'up'|'down', dx, dy }

    // Right-click / context menu
    this.rightClicked = false;
    this.rightClickX = 0;
    this.rightClickY = 0;

    // Bind handlers
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
    canvas.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  _onContextMenu(e) {
    e.preventDefault();
    const coords = this._getCanvasCoords(e);
    this.rightClicked = true;
    this.rightClickX = coords.x;
    this.rightClickY = coords.y;
    this._emit('contextmenu', coords);
  }

  _onPointerDown(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const coords = this._getCanvasCoords(e);

    // Multi-touch tracking
    this.touches.set(e.pointerId, {
      x: coords.x,
      y: coords.y,
      startX: coords.x,
      startY: coords.y,
      startTime: performance.now()
    });

    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    this.pointer.down = true;
    this.pointer.justPressed = true;
    this.drag.active = true;
    this.drag.startX = coords.x;
    this.drag.startY = coords.y;
    this.drag.dx = 0;
    this.drag.dy = 0;

    // Double-tap detection
    const now = performance.now();
    const timeSinceLastTap = now - this._lastTapTime;
    const distFromLastTap = Math.hypot(coords.x - this._lastTapX, coords.y - this._lastTapY);

    if (timeSinceLastTap < this._doubleTapWindow && distFromLastTap < this._doubleTapDistance) {
      this.doubleTapped = true;
      this.doubleTapX = coords.x;
      this.doubleTapY = coords.y;
      this._emit('doubletap', { x: coords.x, y: coords.y });
    }

    // Long-press start
    this._clearLongPress();
    this._longPressTimeout = setTimeout(() => {
      if (this.pointer.down) {
        const currentDist = Math.hypot(
          this.pointer.x - coords.x,
          this.pointer.y - coords.y
        );
        if (currentDist < 10) {
          this.longPressed = true;
          this.longPressX = this.pointer.x;
          this.longPressY = this.pointer.y;
          this._emit('longpress', { x: this.pointer.x, y: this.pointer.y });
        }
      }
    }, this._longPressDuration);

    this._emit('pointerdown', coords);
  }

  _onPointerMove(e) {
    e.preventDefault();
    const coords = this._getCanvasCoords(e);

    // Update multi-touch
    const touch = this.touches.get(e.pointerId);
    if (touch) {
      touch.x = coords.x;
      touch.y = coords.y;
    }

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
    const now = performance.now();

    // Swipe detection
    const touch = this.touches.get(e.pointerId);
    if (touch) {
      const elapsed = now - touch.startTime;
      const dx = coords.x - touch.startX;
      const dy = coords.y - touch.startY;
      const dist = Math.hypot(dx, dy);

      if (elapsed < this._swipeTimeLimit && dist > this._swipeThreshold) {
        let direction;
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
        this.swipe = { direction, dx, dy };
        this._emit('swipe', this.swipe);
      }

      this.touches.delete(e.pointerId);
    }

    // Update last tap time for double-tap detection
    this._lastTapTime = now;
    this._lastTapX = coords.x;
    this._lastTapY = coords.y;

    this._clearLongPress();

    this.pointer.x = coords.x;
    this.pointer.y = coords.y;
    this.pointer.down = false;
    this.pointer.justReleased = true;
    this.drag.active = false;
    this._emit('pointerup', coords);
  }

  _clearLongPress() {
    if (this._longPressTimeout !== null) {
      clearTimeout(this._longPressTimeout);
      this._longPressTimeout = null;
    }
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    this.keysJustPressed[e.code] = true;

    // Keyboard shortcuts
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (ctrl && shift && (e.code === 'KeyZ')) {
      e.preventDefault();
      this._emit('shortcut', { action: 'redo' });
    } else if (ctrl && e.code === 'KeyZ') {
      e.preventDefault();
      this._emit('shortcut', { action: 'undo' });
    } else if (e.code === 'KeyH' && !ctrl && !shift) {
      this._emit('shortcut', { action: 'hint' });
    } else if (e.code === 'KeyN' && !ctrl && !shift) {
      this._emit('shortcut', { action: 'newGame' });
    } else if (e.code === 'KeyA' && !ctrl && !shift) {
      this._emit('shortcut', { action: 'autoComplete' });
    } else if (e.code === 'KeyR' && !ctrl && !shift) {
      this._emit('shortcut', { action: 'rewardedHint' });
    } else if (e.code === 'Escape') {
      this._emit('shortcut', { action: 'pause' });
    } else if (e.code === 'Space') {
      e.preventDefault();
      this._emit('shortcut', { action: 'toggle' });
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  /**
   * Register an event listener.
   * Events: pointerdown, pointermove, pointerup, doubletap, longpress,
   *         swipe, contextmenu, shortcut
   */
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

  /**
   * Get the number of active touch points.
   * @returns {number}
   */
  getTouchCount() {
    return this.touches.size;
  }

  /**
   * Clear per-frame state (call at end of each frame).
   */
  endFrame() {
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
    this.keysJustPressed = {};
    this.doubleTapped = false;
    this.longPressed = false;
    this.rightClicked = false;
    this.swipe = null;
  }

  destroy() {
    this._clearLongPress();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }
}
