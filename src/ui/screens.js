/**
 * All game screens rendered on canvas overlays.
 * Main Menu, Mode Select, Settings, Statistics, Pause, Win, Game Over.
 * Each screen has enter/exit animations. Every button has hover/press and audio.
 */

import { easeOutCubic, easeOutBounce, clamp } from '../core/math.js';
import { THEMES, DEFAULT_THEME } from '../config/themes.js';
import { SCORING } from '../config/scoring.js';

class ScreenButton {
  constructor(label, action, opts = {}) {
    this.label = label;
    this.action = action;
    this.x = 0; this.y = 0; this.width = 0; this.height = 0;
    this.hovered = false; this.pressed = false;
    this.enabled = opts.enabled !== false;
    this.secondary = opts.secondary || false;
    this.toggle = opts.toggle || false;
    this.toggleState = opts.toggleState || false;
  }
  containsPoint(px, py) {
    return this.enabled && px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }
  render(ctx, fontSize) {
    const { x, y, width: w, height: h } = this;
    const r = h * 0.25;
    ctx.save();
    let bg = this.secondary ? 'rgba(255,255,255,0.08)' : 'rgba(50,130,80,0.85)';
    if (!this.enabled) bg = 'rgba(80,80,80,0.5)';
    else if (this.pressed) bg = 'rgba(255,255,255,0.25)';
    else if (this.hovered) bg = this.secondary ? 'rgba(255,255,255,0.15)' : 'rgba(70,160,100,0.9)';
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = this.enabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = this.enabled ? '#ffffff' : '#888888';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let displayLabel = this.label;
    if (this.toggle) displayLabel = `${this.label}: ${this.toggleState ? 'ON' : 'OFF'}`;
    ctx.fillText(displayLabel, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

export class Screens {
  constructor(renderer, audio) {
    this.renderer = renderer;
    this.audio = audio;
    this.activeScreen = null;
    this.buttons = [];
    this.animTime = 0;
    this.animDuration = 0.3;
    this.transitioning = false;
    this.transitionDir = 1; // 1 = entering, -1 = exiting
    this.nextScreen = null;
    // Data
    this.stats = { played: 0, won: 0, bestTime: null, currentStreak: 0, longestStreak: 0 };
    this.settings = { soundEnabled: true, cardTheme: DEFAULT_THEME, drawMode: 1 };
    this.winData = { score: 0, moves: 0, time: 0 };
    this.hasSavedGame = false;
    // Coach marks
    this.coachStep = 0;
    this.showCoach = false;
    this.coachDismissed = false;
    // Pointer tracking for hover
    this.pointerX = -1; this.pointerY = -1;
  }

  show(screenName, data) {
    if (data) {
      if (screenName === 'win') this.winData = data;
    }
    if (this.activeScreen) {
      this.nextScreen = screenName;
      this.transitioning = true;
      this.transitionDir = -1;
      this.animTime = 0;
    } else {
      this.activeScreen = screenName;
      this.transitioning = true;
      this.transitionDir = 1;
      this.animTime = 0;
      this._buildButtons();
    }
  }

  hide() {
    this.transitioning = true;
    this.transitionDir = -1;
    this.animTime = 0;
    this.nextScreen = null;
  }

  isActive() {
    return this.activeScreen !== null;
  }

  setStats(stats) { this.stats = { ...this.stats, ...stats }; }
  setSettings(settings) { this.settings = { ...this.settings, ...settings }; }
  setHasSavedGame(val) { this.hasSavedGame = val; }

  showCoachMarks() {
    this.showCoach = true;
    this.coachStep = 0;
    this.coachDismissed = false;
  }

  updatePointer(x, y) {
    this.pointerX = x; this.pointerY = y;
    for (const btn of this.buttons) btn.hovered = btn.containsPoint(x, y);
  }

  update(dt) {
    if (this.transitioning) {
      this.animTime += dt;
      if (this.animTime >= this.animDuration) {
        this.animTime = this.animDuration;
        this.transitioning = false;
        if (this.transitionDir === -1) {
          this.activeScreen = this.nextScreen;
          this.nextScreen = null;
          if (this.activeScreen) {
            this.transitioning = true;
            this.transitionDir = 1;
            this.animTime = 0;
            this._buildButtons();
          }
        }
      }
    }
  }

  render() {
    if (!this.activeScreen && !this.transitioning) {
      this._renderCoach();
      return;
    }
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    // Animation alpha
    let alpha = 1;
    if (this.transitioning) {
      const t = clamp(this.animTime / this.animDuration, 0, 1);
      alpha = this.transitionDir === 1 ? easeOutCubic(t) : 1 - easeOutCubic(t);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    switch (this.activeScreen) {
      case 'mainMenu': this._renderMainMenu(ctx, w, h); break;
      case 'modeSelect': this._renderModeSelect(ctx, w, h); break;
      case 'settings': this._renderSettings(ctx, w, h); break;
      case 'statistics': this._renderStatistics(ctx, w, h); break;
      case 'pause': this._renderPause(ctx, w, h); break;
      case 'win': this._renderWin(ctx, w, h); break;
      case 'gameOver': this._renderGameOver(ctx, w, h); break;
    }

    // Render all buttons
    const fontSize = Math.min(w * 0.04, 18);
    for (const btn of this.buttons) btn.render(ctx, fontSize);

    ctx.restore();

    this._renderCoach();
  }

  handleClick(x, y) {
    // Coach marks take priority
    if (this.showCoach && !this.coachDismissed) {
      this.coachStep++;
      if (this.coachStep >= 4) {
        this.coachDismissed = true;
        this.showCoach = false;
      }
      if (this.audio) this.audio.play('buttonClick');
      return null;
    }

    if (!this.activeScreen) return null;

    for (const btn of this.buttons) {
      if (btn.containsPoint(x, y)) {
        btn.pressed = true;
        setTimeout(() => { btn.pressed = false; }, 100);
        if (this.audio) this.audio.play('buttonClick');
        return btn.action;
      }
    }
    return null;
  }

  _buildButtons() {
    this.buttons = [];
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    const btnW = Math.min(w * 0.55, 220);
    const btnH = Math.min(h * 0.07, 42);
    const gap = btnH * 0.4;
    const cx = (w - btnW) / 2;

    switch (this.activeScreen) {
      case 'mainMenu': {
        const startY = h * 0.35;
        const items = [
          ['New Game', 'modeSelect'],
          ['Continue', 'continue'],
          ['Settings', 'settings'],
          ['Statistics', 'statistics']
        ];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1]);
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          if (item[1] === 'continue') btn.enabled = this.hasSavedGame;
          this.buttons.push(btn);
        });
        break;
      }
      case 'modeSelect': {
        const startY = h * 0.38;
        const items = [
          ['Easy (Draw 1, Untimed)', 'startEasy'],
          ['Hard (Draw 3, 10min Timer)', 'startHard'],
          ['Back', 'mainMenu']
        ];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: i === 2 });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'settings': {
        const startY = h * 0.32;
        const soundBtn = new ScreenButton('Sound', 'toggleSound', { toggle: true, toggleState: this.settings.soundEnabled });
        soundBtn.x = cx; soundBtn.y = startY; soundBtn.width = btnW; soundBtn.height = btnH;
        this.buttons.push(soundBtn);

        const themeKeys = Object.keys(THEMES).filter(k => THEMES[k].unlocked !== false);
        const currentTheme = THEMES[this.settings.cardTheme] || THEMES[DEFAULT_THEME];
        const themeBtn = new ScreenButton(`Theme: ${currentTheme.name}`, 'cycleTheme');
        themeBtn.x = cx; themeBtn.y = startY + (btnH + gap); themeBtn.width = btnW; themeBtn.height = btnH;
        this.buttons.push(themeBtn);

        const drawBtn = new ScreenButton(`Draw: ${this.settings.drawMode}`, 'cycleDrawMode');
        drawBtn.x = cx; drawBtn.y = startY + 2 * (btnH + gap); drawBtn.width = btnW; drawBtn.height = btnH;
        this.buttons.push(drawBtn);

        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = startY + 3 * (btnH + gap); backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'statistics': {
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = h * 0.75; backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'pause': {
        const startY = h * 0.35;
        const items = [['Resume', 'resume'], ['Restart', 'restart'], ['Quit to Menu', 'quit']];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: i === 2 });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'win': {
        const startY = h * 0.62;
        const items = [['Play Again', 'playAgain'], ['Main Menu', 'quit']];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: i === 1 });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'gameOver': {
        const startY = h * 0.55;
        const items = [['Try Again', 'playAgain'], ['Main Menu', 'quit']];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: i === 1 });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
    }
  }

  _renderMainMenu(ctx, w, h) {
    // Title
    const titleSize = Math.min(w * 0.09, 48);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Klondike Solitaire', w / 2, h * 0.18);
    // Subtitle
    ctx.font = `${titleSize * 0.4}px system-ui, sans-serif`;
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Classic Card Game', w / 2, h * 0.26);
    // Suit decorations
    ctx.font = `${titleSize * 0.8}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,215,0,0.3)';
    ctx.fillText('\u2660 \u2665 \u2666 \u2663', w / 2, h * 0.88);
  }

  _renderModeSelect(ctx, w, h) {
    const titleSize = Math.min(w * 0.07, 36);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Select Mode', w / 2, h * 0.25);
  }

  _renderSettings(ctx, w, h) {
    const titleSize = Math.min(w * 0.07, 36);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Settings', w / 2, h * 0.2);
  }

  _renderStatistics(ctx, w, h) {
    const titleSize = Math.min(w * 0.07, 36);
    const statSize = Math.min(w * 0.04, 18);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Statistics', w / 2, h * 0.15);

    const s = this.stats;
    const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
    const bestTimeStr = s.bestTime !== null ?
      `${Math.floor(s.bestTime / 60)}:${Math.floor(s.bestTime % 60).toString().padStart(2, '0')}` : '--:--';

    const lines = [
      `Games Played: ${s.played}`,
      `Games Won: ${s.won}`,
      `Win Rate: ${winPct}%`,
      `Best Time: ${bestTimeStr}`,
      `Current Streak: ${s.currentStreak}`,
      `Longest Streak: ${s.longestStreak}`
    ];

    ctx.font = `${statSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#dddddd';
    lines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h * 0.3 + i * (statSize + 12));
    });
  }

  _renderPause(ctx, w, h) {
    const titleSize = Math.min(w * 0.08, 40);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Paused', w / 2, h * 0.22);
  }

  _renderWin(ctx, w, h) {
    const titleSize = Math.min(w * 0.09, 48);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('You Win!', w / 2, h * 0.2);

    const statSize = Math.min(w * 0.04, 20);
    ctx.font = `${statSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    const d = this.winData;
    const timeStr = `${Math.floor(d.time / 60)}:${Math.floor(d.time % 60).toString().padStart(2, '0')}`;
    ctx.fillText(`Score: ${d.score}`, w / 2, h * 0.35);
    ctx.fillText(`Moves: ${d.moves}`, w / 2, h * 0.42);
    ctx.fillText(`Time: ${timeStr}`, w / 2, h * 0.49);
  }

  _renderGameOver(ctx, w, h) {
    const titleSize = Math.min(w * 0.08, 42);
    ctx.font = `bold ${titleSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Time\'s Up!', w / 2, h * 0.25);

    const statSize = Math.min(w * 0.04, 18);
    ctx.font = `${statSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#dddddd';
    ctx.fillText('The timer ran out. Better luck next time!', w / 2, h * 0.38);
    ctx.fillText(`Final Score: ${this.winData.score || 0}`, w / 2, h * 0.45);
  }

  _renderCoach() {
    if (!this.showCoach || this.coachDismissed) return;
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    const messages = [
      'Drag cards to move them between columns.',
      'Build tableau columns in alternating colors (red/black), descending rank.',
      'Move Aces to foundations, then build up by suit to King.',
      'Tap here to dismiss. Good luck!'
    ];

    const msg = messages[this.coachStep] || messages[messages.length - 1];
    const fontSize = Math.min(w * 0.04, 16);
    const padX = 16; const padY = 10;

    ctx.save();
    // Position near center
    const boxW = Math.min(w * 0.8, 340);
    const boxH = fontSize + padY * 2 + 20;
    const boxX = (w - boxW) / 2;
    const boxY = h * 0.45;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY); ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, boxY + boxH / 2 - 6);

    ctx.font = `${fontSize * 0.75}px system-ui, sans-serif`;
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Tap to continue (${this.coachStep + 1}/4)`, w / 2, boxY + boxH - 12);
    ctx.restore();
  }
}
