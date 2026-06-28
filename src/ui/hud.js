/**
 * Premium in-game HUD rendered on canvas.
 * Neomorphism styled buttons, animated score counter, move counter,
 * timer with pulsing low-time warning, XP bar, daily streak badge,
 * score popups with physics, undo/redo/hint/menu/auto-complete buttons.
 */

import { SCORING } from '../config/scoring.js';
import { easeOutCubic, clamp } from '../core/math.js';

class HudButton {
  constructor(label, icon, action) {
    this.label = label;
    this.icon = icon || '';
    this.action = action || '';
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.hovered = false;
    this.pressed = false;
    this.visible = true;
    this.alpha = 1;
    this.scale = 1;
    this.glowIntensity = 0;
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

    // Neomorphism background
    let bgColor = 'rgba(15,35,20,0.85)';
    let borderColor = 'rgba(255,255,255,0.12)';
    if (this.pressed) {
      bgColor = 'rgba(212,175,55,0.3)';
      borderColor = 'rgba(212,175,55,0.5)';
    } else if (this.hovered) {
      bgColor = 'rgba(20,50,30,0.9)';
      borderColor = 'rgba(212,175,55,0.4)';
    }

    // Outer shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

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

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Inner highlight
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glow effect
    if (this.glowIntensity > 0) {
      ctx.globalAlpha = this.glowIntensity * 0.3;
      ctx.fillStyle = '#d4af37';
      ctx.fill();
      ctx.globalAlpha = this.alpha;
    }

    // Icon/text
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = this.hovered ? '#d4af37' : '#ffffff';
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

class ScorePopup {
  constructor(value, x, y) {
    this.value = value;
    this.x = x;
    this.y = y;
    this.startY = y;
    this.time = 0;
    this.duration = 1.2;
    this.alive = true;
    this.vx = (Math.random() - 0.5) * 20;
  }

  update(dt) {
    this.time += dt;
    if (this.time >= this.duration) {
      this.alive = false;
      return;
    }
    const t = this.time / this.duration;
    this.y = this.startY - 50 * easeOutCubic(t);
    this.x += this.vx * dt;
  }

  render(ctx, fontSize) {
    if (!this.alive) return;
    const t = this.time / this.duration;
    const alpha = 1 - t;
    const scale = 1 + (1 - t) * 0.3;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.round(fontSize * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.value >= 0 ? '#44ff88' : '#ff5555';
    // Shadow for readability
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
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
    this.undoBtn = new HudButton('Undo', '\u21A9', 'undo');
    this.redoBtn = new HudButton('Redo', '\u21AA', 'redo');
    this.hintBtn = new HudButton('Hint', '\u2728', 'hint');
    this.menuBtn = new HudButton('Menu', '\u2630', 'menu');
    this.autoCompleteBtn = new HudButton('Auto', '\u2714', 'autoComplete');
    this.autoCompleteBtn.visible = false;

    this.buttons = [this.undoBtn, this.redoBtn, this.hintBtn, this.menuBtn, this.autoCompleteBtn];

    // Score animation
    this.displayScore = 0;
    this.targetScore = 0;
    this.scorePopups = [];
    this.lastScore = 0;

    // Pointer state
    this.pointerX = -1;
    this.pointerY = -1;

    // Auto-complete pulse
    this.autoPulse = 0;

    // Timer warning
    this.timerPulse = 0;

    // XP bar animation
    this.displayXp = 0;

    // Daily streak
    this.streak = 0;
  }

  setStreak(streak) {
    this.streak = streak;
  }

  setXpProgress(current, max, level) {
    this.xpCurrent = current;
    this.xpMax = max;
    this.xpLevel = level;
  }

  addScorePopup(value, x, y) {
    if (value === 0) return;
    this.scorePopups.push(new ScorePopup(value, x, y));
  }

  updatePointer(x, y) {
    this.pointerX = x;
    this.pointerY = y;
    for (const btn of this.buttons) {
      btn.hovered = btn.containsPoint(x, y);
      if (btn.hovered) {
        btn.glowIntensity = Math.min(btn.glowIntensity + 0.1, 1);
      } else {
        btn.glowIntensity = Math.max(btn.glowIntensity - 0.1, 0);
      }
    }
  }

  update(dt) {
    // Score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      this.scorePopups[i].update(dt);
      if (!this.scorePopups[i].alive) {
        this.scorePopups.splice(i, 1);
      }
    }

    // Animated score counter
    this.targetScore = this.game.score;
    if (this.displayScore !== this.targetScore) {
      const diff = this.targetScore - this.displayScore;
      const step = Math.ceil(Math.abs(diff) * dt * 5);
      if (Math.abs(diff) <= step) {
        this.displayScore = this.targetScore;
      } else {
        this.displayScore += Math.sign(diff) * step;
      }
    }

    // Track score changes for popups
    if (this.game.score !== this.lastScore) {
      const diff = this.game.score - this.lastScore;
      const w = this.renderer.logicalWidth;
      this.addScorePopup(diff, w * 0.12, 32);
      this.lastScore = this.game.score;
    }

    // Auto-complete button
    this.autoCompleteBtn.visible = this.game.canAutoComplete() && !this.game.autoCompleting;
    if (this.autoCompleteBtn.visible) {
      this.autoPulse += dt * 3;
      this.autoCompleteBtn.alpha = 0.7 + 0.3 * Math.sin(this.autoPulse);
      this.autoCompleteBtn.glowIntensity = 0.5 + 0.5 * Math.sin(this.autoPulse);
    }

    // Undo/redo visibility
    this.undoBtn.visible = this.game.canUndo ? this.game.canUndo() : (this.game.undoState !== null);
    this.redoBtn.visible = this.game.canRedo ? this.game.canRedo() : false;

    // Timer warning pulse
    if (this.game.hardMode) {
      const remaining = Math.max(0, this.game.hardModeTime - this.game.timer);
      if (remaining < 60) {
        this.timerPulse += dt * 4;
      }
    }
  }

  render() {
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    // Responsive sizing
    const isSmall = w < 500;
    const fontSize = isSmall ? 11 : 14;
    const btnH = isSmall ? 28 : 34;
    const btnW = isSmall ? 36 : 44;
    const padding = isSmall ? 6 : 10;
    const topMargin = 6;
    const barHeight = btnH + topMargin * 2 + 4;

    // Top bar with neomorphism
    const gradient = ctx.createLinearGradient(0, 0, 0, barHeight);
    gradient.addColorStop(0, 'rgba(10,26,15,0.92)');
    gradient.addColorStop(1, 'rgba(5,15,8,0.88)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, barHeight);

    // Bottom border glow
    ctx.strokeStyle = 'rgba(212,175,55,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barHeight);
    ctx.lineTo(w, barHeight);
    ctx.stroke();

    // Score display (animated)
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const barCenterY = topMargin + btnH / 2 + 2;
    ctx.fillText(`${Math.round(this.displayScore)}`, padding + 2, barCenterY);

    // Move counter
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    const scoreWidth = ctx.measureText(`${Math.round(this.displayScore)}`).width;
    ctx.fillText(`${this.game.moves} moves`, padding + scoreWidth + 14, barCenterY);

    // Timer
    let timerText;
    if (this.game.hardMode) {
      const remaining = Math.max(0, this.game.hardModeTime - this.game.timer);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      timerText = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (remaining < 60) {
        const pulse = Math.sin(this.timerPulse);
        ctx.fillStyle = pulse > 0 ? '#ff4444' : '#ff8844';
      } else {
        ctx.fillStyle = '#ffffff';
      }
    } else {
      const mins = Math.floor(this.game.timer / 60);
      const secs = Math.floor(this.game.timer % 60);
      timerText = `${mins}:${secs.toString().padStart(2, '0')}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
    }
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(timerText, w / 2, barCenterY);

    // Daily streak badge
    if (this.streak > 0) {
      const streakX = w / 2 + 40;
      ctx.font = `${fontSize - 2}px system-ui, sans-serif`;
      ctx.fillStyle = '#ff6600';
      ctx.textAlign = 'left';
      ctx.fillText(`\uD83D\uDD25${this.streak}`, streakX, barCenterY);
    }

    // XP bar (small, below stats)
    if (this.xpMax && this.xpMax > 0) {
      const xpBarW = isSmall ? 60 : 80;
      const xpBarH = 4;
      const xpBarX = padding + 2;
      const xpBarY = barHeight - xpBarH - 3;
      const progress = clamp((this.xpCurrent || 0) / this.xpMax, 0, 1);

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(xpBarX, xpBarY, xpBarW, xpBarH);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(xpBarX, xpBarY, xpBarW * progress, xpBarH);

      if (this.xpLevel) {
        ctx.font = `${fontSize - 3}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(212,175,55,0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(`Lv${this.xpLevel}`, xpBarX + xpBarW + 4, xpBarY + 2);
      }
    }

    // Buttons on right side
    let btnX = w - padding - btnW;

    // Menu button
    this.menuBtn.x = btnX;
    this.menuBtn.y = topMargin;
    this.menuBtn.width = btnW;
    this.menuBtn.height = btnH;
    this.menuBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // Hint button
    this.hintBtn.x = btnX;
    this.hintBtn.y = topMargin;
    this.hintBtn.width = btnW;
    this.hintBtn.height = btnH;
    this.hintBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // Redo button
    this.redoBtn.x = btnX;
    this.redoBtn.y = topMargin;
    this.redoBtn.width = btnW;
    this.redoBtn.height = btnH;
    this.redoBtn.render(ctx, fontSize);
    btnX -= btnW + 4;

    // Undo button
    this.undoBtn.x = btnX;
    this.undoBtn.y = topMargin;
    this.undoBtn.width = btnW;
    this.undoBtn.height = btnH;
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

    // Score popups
    for (const popup of this.scorePopups) {
      popup.render(ctx, fontSize + 2);
    }
  }

  handleClick(x, y) {
    for (const btn of this.buttons) {
      if (btn.visible && btn.containsPoint(x, y)) {
        btn.pressed = true;
        setTimeout(() => { btn.pressed = false; }, 100);
        return btn.action;
      }
    }
    return false;
  }

  isInHudArea(x, y) {
    const w = this.renderer.logicalWidth;
    const isSmall = w < 500;
    const btnH = isSmall ? 28 : 34;
    return y < btnH + 16;
  }
}
