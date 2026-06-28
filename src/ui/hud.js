/**
 * In-game HUD rendered on canvas.
 * Score display, move counter, timer, undo/new game/menu buttons.
 * All interactive elements have hover/press states and audio feedback.
 * Responsive positioning for all screen sizes.
 */

import { SCORING } from '../config/scoring.js';
import { easeOutCubic, clamp } from '../core/math.js';

/**
 * A canvas button with hover/press states.
 */
class HudButton {
  constructor(label, icon) {
    this.label = label;
    this.icon = icon || '';
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.hovered = false;
    this.pressed = false;
    this.visible = true;
    this.alpha = 1;
  }

  containsPoint(px, py) {
    if (!this.visible) return false;
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }

  render(ctx, fontSize) {
    if (!this.visible) return;

    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;
    const r = h * 0.3;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    // Background
    let bgColor = 'rgba(0,0,0,0.4)';
    if (this.pressed) {
      bgColor = 'rgba(255,255,255,0.2)';
    } else if (this.hovered) {
      bgColor = 'rgba(255,255,255,0.1)';
    }

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
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Border
    ctx.strokeStyle = this.hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.icon) {
      ctx.fillText(this.icon, x + w / 2, y + h / 2);
    } else {
      ctx.fillText(this.label, x + w / 2, y + h / 2);
    }

    ctx.restore();
  }
}

/**
 * Floating score change animation.
 */
class ScorePopup {
  constructor(value, x, y) {
    this.value = value;
    this.x = x;
    this.y = y;
    this.startY = y;
    this.time = 0;
    this.duration = 1.2;
    this.alive = true;
  }

  update(dt) {
    this.time += dt;
    if (this.time >= this.duration) {
      this.alive = false;
      return;
    }
    const t = this.time / this.duration;
    this.y = this.startY - 40 * easeOutCubic(t);
  }

  render(ctx, fontSize) {
    if (!this.alive) return;
    const t = this.time / this.duration;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.value >= 0 ? '#44ff44' : '#ff4444';
    const prefix = this.value >= 0 ? '+' : '';
    ctx.fillText(`${prefix}${this.value}`, this.x, this.y);
    ctx.restore();
  }
}

export class HUD {
  constructor(game, renderer) {
    this.game = game;
    this.renderer = renderer;

    // Buttons
    this.undoBtn = new HudButton('Undo', '\u21A9');
    this.menuBtn = new HudButton('Menu', '\u2630');
    this.newGameBtn = new HudButton('New', '\u2795');
    this.autoCompleteBtn = new HudButton('Auto', '\u2714');
    this.autoCompleteBtn.visible = false;

    this.buttons = [this.undoBtn, this.menuBtn, this.newGameBtn, this.autoCompleteBtn];

    // Score popups
    this.scorePopups = [];
    this.lastScore = 0;

    // Pointer state for hover detection
    this.pointerX = -1;
    this.pointerY = -1;

    // Auto-complete button pulse
    this.autoPulse = 0;
  }

  /**
   * Add a score popup animation at a position.
   */
  addScorePopup(value, x, y) {
    if (value === 0) return;
    this.scorePopups.push(new ScorePopup(value, x, y));
  }

  /**
   * Update hover state for pointer position.
   */
  updatePointer(x, y) {
    this.pointerX = x;
    this.pointerY = y;
    for (const btn of this.buttons) {
      btn.hovered = btn.containsPoint(x, y);
    }
  }

  update(dt) {
    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      this.scorePopups[i].update(dt);
      if (!this.scorePopups[i].alive) {
        this.scorePopups.splice(i, 1);
      }
    }

    // Track score changes for popups
    if (this.game.score !== this.lastScore) {
      const diff = this.game.score - this.lastScore;
      const w = this.renderer.logicalWidth;
      this.addScorePopup(diff, w * 0.15, 28);
      this.lastScore = this.game.score;
    }

    // Auto-complete button visibility
    this.autoCompleteBtn.visible = this.game.canAutoComplete() && !this.game.autoCompleting;
    if (this.autoCompleteBtn.visible) {
      this.autoPulse += dt * 2;
      this.autoCompleteBtn.alpha = 0.7 + 0.3 * Math.sin(this.autoPulse);
    }
  }

  render() {
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    // Responsive sizing
    const isSmall = w < 500;
    const fontSize = isSmall ? 11 : 14;
    const btnH = isSmall ? 26 : 32;
    const btnW = isSmall ? 34 : 42;
    const padding = isSmall ? 4 : 8;
    const topMargin = 6;

    // -- Top bar background --
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, btnH + topMargin * 2 + 2);

    // -- Score display --
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const barCenterY = topMargin + btnH / 2 + 1;
    ctx.fillText(`Score: ${this.game.score}`, padding + 2, barCenterY);

    // -- Move counter --
    const moveText = `Moves: ${this.game.moves}`;
    const scoreWidth = ctx.measureText(`Score: ${this.game.score}`).width;
    ctx.fillText(moveText, padding + scoreWidth + 16, barCenterY);

    // -- Timer --
    let timerText;
    if (this.game.hardMode) {
      const remaining = Math.max(0, this.game.hardModeTime - this.game.timer);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      timerText = `${mins}:${secs.toString().padStart(2, '0')}`;
      // Flash red when low time
      if (remaining < 60) {
        ctx.fillStyle = remaining % 1 < 0.5 ? '#ff4444' : '#ffaa44';
      } else {
        ctx.fillStyle = '#ffffff';
      }
    } else {
      const mins = Math.floor(this.game.timer / 60);
      const secs = Math.floor(this.game.timer % 60);
      timerText = `${mins}:${secs.toString().padStart(2, '0')}`;
      ctx.fillStyle = '#ffffff';
    }
    ctx.textAlign = 'center';
    ctx.fillText(timerText, w / 2, barCenterY);

    // -- Buttons on right side --
    let btnX = w - padding - btnW;

    // Menu button
    this.menuBtn.x = btnX;
    this.menuBtn.y = topMargin;
    this.menuBtn.width = btnW;
    this.menuBtn.height = btnH;
    this.menuBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // New game button
    this.newGameBtn.x = btnX;
    this.newGameBtn.y = topMargin;
    this.newGameBtn.width = btnW;
    this.newGameBtn.height = btnH;
    this.newGameBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // Undo button
    this.undoBtn.x = btnX;
    this.undoBtn.y = topMargin;
    this.undoBtn.width = btnW;
    this.undoBtn.height = btnH;
    this.undoBtn.visible = this.game.undoState !== null;
    this.undoBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // Auto-complete button
    if (this.autoCompleteBtn.visible) {
      this.autoCompleteBtn.x = btnX;
      this.autoCompleteBtn.y = topMargin;
      this.autoCompleteBtn.width = btnW + 10;
      this.autoCompleteBtn.height = btnH;
      this.autoCompleteBtn.render(ctx, fontSize);
    }

    // -- Score popups --
    for (const popup of this.scorePopups) {
      popup.render(ctx, fontSize + 2);
    }
  }

  /**
   * Handle click on HUD elements.
   * @returns {string|false} action name or false if not handled
   */
  handleClick(x, y) {
    if (this.undoBtn.visible && this.undoBtn.containsPoint(x, y)) {
      this.undoBtn.pressed = true;
      setTimeout(() => { this.undoBtn.pressed = false; }, 100);
      return 'undo';
    }
    if (this.menuBtn.containsPoint(x, y)) {
      this.menuBtn.pressed = true;
      setTimeout(() => { this.menuBtn.pressed = false; }, 100);
      return 'menu';
    }
    if (this.newGameBtn.containsPoint(x, y)) {
      this.newGameBtn.pressed = true;
      setTimeout(() => { this.newGameBtn.pressed = false; }, 100);
      return 'newGame';
    }
    if (this.autoCompleteBtn.visible && this.autoCompleteBtn.containsPoint(x, y)) {
      this.autoCompleteBtn.pressed = true;
      setTimeout(() => { this.autoCompleteBtn.pressed = false; }, 100);
      return 'autoComplete';
    }
    return false;
  }

  /**
   * Check if a point is within the HUD area (top bar).
   */
  isInHudArea(x, y) {
    const w = this.renderer.logicalWidth;
    const isSmall = w < 500;
    const btnH = isSmall ? 26 : 32;
    return y < btnH + 14;
  }
}
