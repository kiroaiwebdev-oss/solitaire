/**
 * All game screens rendered on canvas overlays with neomorphism styling.
 * Screens: Loading, MainMenu, ModeSelect, Settings, Statistics, Achievements,
 * DailyChallenge, Pause, Win, GameOver.
 * Each screen has enter/exit animations. Every button has hover/press and audio.
 */

import { easeOutCubic, easeOutBounce, clamp } from '../core/math.js';
import { THEMES, DEFAULT_THEME, TABLE_THEMES, CARD_FACE_STYLES } from '../config/themes.js';
import { SCORING } from '../config/scoring.js';
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_CATEGORIES } from '../config/achievements.js';

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
    this.slider = opts.slider || false;
    this.sliderValue = opts.sliderValue || 0;
    this.icon = opts.icon || '';
  }
  containsPoint(px, py) {
    return this.enabled && px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }
  render(ctx, fontSize) {
    const { x, y, width: w, height: h } = this;
    const r = h * 0.25;
    ctx.save();

    // Neomorphism button
    let bg = this.secondary ? 'rgba(255,255,255,0.06)' : 'rgba(20,60,35,0.9)';
    if (!this.enabled) bg = 'rgba(40,40,40,0.5)';
    else if (this.pressed) bg = 'rgba(212,175,55,0.25)';
    else if (this.hovered) bg = this.secondary ? 'rgba(255,255,255,0.12)' : 'rgba(30,80,50,0.95)';

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    ctx.fillStyle = bg; ctx.fill();

    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    ctx.strokeStyle = this.hovered ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1; ctx.stroke();

    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = this.enabled ? (this.hovered ? '#d4af37' : '#ffffff') : '#666666';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let displayLabel = this.label;
    if (this.toggle) displayLabel = `${this.label}: ${this.toggleState ? 'ON' : 'OFF'}`;
    if (this.slider) {
      displayLabel = `${this.label}: ${Math.round(this.sliderValue * 100)}%`;
    }
    ctx.fillText(displayLabel, x + w / 2, y + h / 2);

    // Slider bar
    if (this.slider && this.enabled) {
      const barY = y + h - 6;
      const barW = w - 20;
      const barX = x + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(barX, barY, barW * this.sliderValue, 3);
    }

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
    this.transitionDir = 1;
    this.nextScreen = null;
    this.stats = { played: 0, won: 0, bestTime: null, currentStreak: 0, longestStreak: 0, averageTime: null, totalMoves: 0, dailyStreak: 0, dailyChallengesCompleted: 0 };
    this.settings = { soundEnabled: true, musicEnabled: true, cardTheme: DEFAULT_THEME, drawMode: 1, sfxVolume: 0.8, musicVolume: 0.5, animationSpeed: 'normal', autoComplete: true, hintFrequency: 'subtle', cardSize: 'medium', leftHand: false, themeMode: 'dark', tableFelt: 'green', cardFaceStyle: 'classic', reducedMotion: false };
    this.winData = { score: 0, moves: 0, time: 0 };
    this.hasSavedGame = false;
    this.coachStep = 0;
    this.showCoach = false;
    this.coachDismissed = false;
    this.pointerX = -1; this.pointerY = -1;
    this.loadProgress = 0;
    this.loadTime = 0;
    this.achievementsData = { unlocked: [], progress: {} };
    this.dailyData = { completed: false, streak: 0, calendar: [] };
    this.progressionData = { level: 1, xp: 0, xpNext: 100 };
    this.achievementCategory = 'all';
    this.dragSlider = null;
  }

  show(screenName, data) {
    if (data) {
      if (screenName === 'win') this.winData = data;
      if (screenName === 'gameOver') this.winData = data;
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

  isActive() { return this.activeScreen !== null; }
  setStats(stats) { this.stats = { ...this.stats, ...stats }; }
  setSettings(settings) { this.settings = { ...this.settings, ...settings }; }
  setHasSavedGame(val) { this.hasSavedGame = val; }
  setAchievements(data) { this.achievementsData = data; }
  setDailyData(data) { this.dailyData = data; }
  setProgression(data) { this.progressionData = data; }

  showCoachMarks() {
    this.showCoach = true;
    this.coachStep = 0;
    this.coachDismissed = false;
  }

  updatePointer(x, y) {
    this.pointerX = x; this.pointerY = y;
    for (const btn of this.buttons) btn.hovered = btn.containsPoint(x, y);

    // Handle slider dragging
    if (this.dragSlider) {
      const btn = this.dragSlider;
      const relX = clamp((x - btn.x - 10) / (btn.width - 20), 0, 1);
      btn.sliderValue = relX;
    }
  }

  handleSliderStart(x, y) {
    for (const btn of this.buttons) {
      if (btn.slider && btn.containsPoint(x, y)) {
        this.dragSlider = btn;
        const relX = clamp((x - btn.x - 10) / (btn.width - 20), 0, 1);
        btn.sliderValue = relX;
        return btn.action;
      }
    }
    return null;
  }

  handleSliderEnd() {
    const btn = this.dragSlider;
    this.dragSlider = null;
    if (btn) return { action: btn.action, value: btn.sliderValue };
    return null;
  }

  update(dt) {
    if (this.activeScreen === 'loading') {
      this.loadTime += dt;
      this.loadProgress = clamp(this.loadTime / 1.5, 0, 1);
    }
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

    let alpha = 1;
    if (this.transitioning) {
      const t = clamp(this.animTime / this.animDuration, 0, 1);
      alpha = this.transitionDir === 1 ? easeOutCubic(t) : 1 - easeOutCubic(t);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Overlay background
    ctx.fillStyle = 'rgba(9,26,16,0.92)';
    ctx.fillRect(0, 0, w, h);

    switch (this.activeScreen) {
      case 'loading': this._renderLoading(ctx, w, h); break;
      case 'mainMenu': this._renderMainMenu(ctx, w, h); break;
      case 'modeSelect': this._renderModeSelect(ctx, w, h); break;
      case 'settings': this._renderSettings(ctx, w, h); break;
      case 'statistics': this._renderStatistics(ctx, w, h); break;
      case 'achievements': this._renderAchievements(ctx, w, h); break;
      case 'dailyChallenge': this._renderDailyChallenge(ctx, w, h); break;
      case 'pause': this._renderPause(ctx, w, h); break;
      case 'win': this._renderWin(ctx, w, h); break;
      case 'gameOver': this._renderGameOver(ctx, w, h); break;
    }

    const fontSize = Math.min(w * 0.038, 16);
    for (const btn of this.buttons) btn.render(ctx, fontSize);

    ctx.restore();
    this._renderCoach();
  }

  handleClick(x, y) {
    if (this.showCoach && !this.coachDismissed) {
      this.coachStep++;
      if (this.coachStep >= 4) { this.coachDismissed = true; this.showCoach = false; }
      if (this.audio) this.audio.play('buttonClick');
      return null;
    }
    if (!this.activeScreen) return null;

    // Check slider first
    const sliderAction = this.handleSliderStart(x, y);
    if (sliderAction) return sliderAction;

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
    const btnW = Math.min(w * 0.6, 240);
    const btnH = Math.min(h * 0.065, 40);
    const gap = btnH * 0.35;
    const cx = (w - btnW) / 2;

    switch (this.activeScreen) {
      case 'loading': break;
      case 'mainMenu': {
        const startY = h * 0.35;
        const items = [
          ['New Game', 'modeSelect'],
          ['Daily Challenge', 'dailyChallenge'],
          ['Continue', 'continue'],
          ['Statistics', 'statistics'],
          ['Achievements', 'achievements'],
          ['Settings', 'settings']
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
        const startY = h * 0.25;
        const items = [
          ['Easy (Draw 1, Untimed)', 'startEasy'],
          ['Medium (Draw 1, Timed)', 'startMedium'],
          ['Hard (Draw 3, Untimed)', 'startHard'],
          ['Expert (Draw 3, Timed)', 'startExpert'],
          ['Back', 'back']
        ];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: item[1] === 'back' });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'settings': {
        const startY = h * 0.12;
        const smallBtnH = Math.min(btnH * 0.9, 36);
        const smallGap = smallBtnH * 0.25;

        const settingsItems = [
          { label: 'SFX Volume', action: 'sfxVolume', slider: true, value: this.settings.sfxVolume || 0.8 },
          { label: 'Music Volume', action: 'musicVolume', slider: true, value: this.settings.musicVolume || 0.5 },
          { label: 'Animation', action: 'cycleAnimSpeed', toggle: false, display: this.settings.animationSpeed || 'normal' },
          { label: 'Auto-Complete', action: 'toggleAutoComplete', toggle: true, state: this.settings.autoComplete !== false },
          { label: 'Hints', action: 'cycleHints', toggle: false, display: this.settings.hintFrequency || 'subtle' },
          { label: 'Card Size', action: 'cycleCardSize', toggle: false, display: this.settings.cardSize || 'medium' },
          { label: 'Left-Hand Mode', action: 'toggleLeftHand', toggle: true, state: this.settings.leftHand || false },
          { label: 'Theme Mode', action: 'cycleThemeMode', toggle: false, display: this.settings.themeMode || 'dark' },
          { label: 'Card Back', action: 'cycleTheme', toggle: false, display: (THEMES[this.settings.cardTheme] || THEMES[DEFAULT_THEME]).name },
          { label: 'Table Felt', action: 'cycleTableFelt', toggle: false, display: this.settings.tableFelt || 'green' },
          { label: 'Card Style', action: 'cycleCardFace', toggle: false, display: this.settings.cardFaceStyle || 'classic' },
          { label: 'Reduced Motion', action: 'toggleReducedMotion', toggle: true, state: this.settings.reducedMotion || false },
        ];

        settingsItems.forEach((item, i) => {
          let opts = {};
          if (item.slider) {
            opts = { slider: true, sliderValue: item.value };
          } else if (item.toggle) {
            opts = { toggle: true, toggleState: item.state };
          }
          const displayLabel = item.display ? item.label + ': ' + item.display : item.label;
          const btn = new ScreenButton(item.slider ? item.label : displayLabel, item.action, opts);
          btn.x = cx; btn.y = startY + i * (smallBtnH + smallGap);
          btn.width = btnW; btn.height = smallBtnH;
          this.buttons.push(btn);
        });

        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = startY + settingsItems.length * (smallBtnH + smallGap) + smallGap;
        backBtn.width = btnW; backBtn.height = smallBtnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'statistics': {
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = h * 0.88; backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'achievements': {
        const startY = h * 0.12;
        const cats = ['All', 'Beginner', 'Advanced', 'Special'];
        const catBtnW = btnW / cats.length - 4;
        cats.forEach((cat, i) => {
          const btn = new ScreenButton(cat, 'achCat_' + cat.toLowerCase(), { secondary: cat.toLowerCase() !== this.achievementCategory });
          btn.x = cx + i * (catBtnW + 4); btn.y = startY;
          btn.width = catBtnW; btn.height = btnH * 0.8;
          this.buttons.push(btn);
        });
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = h * 0.88; backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'dailyChallenge': {
        const startY = h * 0.55;
        const dailyLabel = this.dailyData.completed ? 'Completed!' : 'Start Today's Challenge';
        const btn = new ScreenButton(dailyLabel, 'startDaily', { enabled: !this.dailyData.completed });
        btn.x = cx; btn.y = startY; btn.width = btnW; btn.height = btnH;
        this.buttons.push(btn);
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = startY + btnH + gap; backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'pause': {
        const startY = h * 0.3;
        const items = [['Resume', 'resume'], ['Restart', 'restart'], ['Settings', 'settings'], ['Quit to Menu', 'quit']];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: item[1] === 'quit' });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'win': {
        const startY = h * 0.65;
        const items = [['Play Again', 'playAgain'], ['Main Menu', 'mainMenu']];
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
        const items = [['Try Again', 'playAgain'], ['Main Menu', 'mainMenu']];
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

  _renderLoading(ctx, w, h) {
    // Animated card logo
    const t = this.loadTime * 2;
    const suits = ['♠', '♥', '♦', '♣'];
    const logoSize = Math.min(w * 0.12, 60);
    ctx.font = logoSize + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    suits.forEach((s, i) => {
      const angle = t + (i * Math.PI / 2);
      const radius = logoSize * 0.8;
      const sx = w / 2 + Math.cos(angle) * radius;
      const sy = h * 0.35 + Math.sin(angle) * radius;
      ctx.fillStyle = (i === 1 || i === 2) ? '#cc0000' : '#ffffff';
      ctx.fillText(s, sx, sy);
    });

    // Title
    const titleSize = Math.min(w * 0.08, 40);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.fillText('Premium Solitaire', w / 2, h * 0.55);

    // Progress bar
    const barW = Math.min(w * 0.6, 250);
    const barH = 6;
    const barX = (w - barW) / 2;
    const barY = h * 0.65;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(barX, barY, barW * this.loadProgress, barH);
  }

  _renderMainMenu(ctx, w, h) {
    // Title with gold gradient
    const titleSize = Math.min(w * 0.09, 48);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Premium Solitaire', w / 2, h * 0.12);

    // Subtitle
    ctx.font = (titleSize * 0.35) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Classic Klondike', w / 2, h * 0.2);

    // Floating decorative suits at bottom
    ctx.font = (titleSize * 0.6) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(212,175,55,0.2)';
    ctx.fillText('♠  ♥  ♦  ♣', w / 2, h * 0.92);

    // Level indicator
    if (this.progressionData && this.progressionData.level > 1) {
      ctx.font = (titleSize * 0.3) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(212,175,55,0.6)';
      ctx.fillText('Level ' + this.progressionData.level, w / 2, h * 0.26);
    }
  }

  _renderModeSelect(ctx, w, h) {
    const titleSize = Math.min(w * 0.07, 36);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Select Difficulty', w / 2, h * 0.14);

    ctx.font = (titleSize * 0.45) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Choose your challenge level', w / 2, h * 0.2);
  }

  _renderSettings(ctx, w, h) {
    const titleSize = Math.min(w * 0.06, 32);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Settings', w / 2, h * 0.06);
  }

  _renderStatistics(ctx, w, h) {
    const titleSize = Math.min(w * 0.06, 32);
    const statSize = Math.min(w * 0.033, 15);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Statistics', w / 2, h * 0.06);

    const s = this.stats;
    const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
    const bestTimeStr = s.bestTime !== null ? Math.floor(s.bestTime / 60) + ':' + Math.floor(s.bestTime % 60).toString().padStart(2, '0') : '--:--';
    const avgTimeStr = s.averageTime !== null ? Math.floor(s.averageTime / 60) + ':' + Math.floor(s.averageTime % 60).toString().padStart(2, '0') : '--:--';

    // Progress ring for win rate
    const ringX = w * 0.25;
    const ringY = h * 0.22;
    const ringR = Math.min(w * 0.08, 35);
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * winPct / 100));
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = 'bold ' + (statSize + 2) + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(winPct + '%', ringX, ringY);
    ctx.font = (statSize - 2) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Win Rate', ringX, ringY + ringR + 14);

    // Stats columns
    const leftX = w * 0.52;
    ctx.textAlign = 'left';
    const lines = [
      ['Games Played', s.played],
      ['Games Won', s.won],
      ['Best Time', bestTimeStr],
      ['Avg Time', avgTimeStr],
      ['Current Streak', s.currentStreak],
      ['Longest Streak', s.longestStreak || 0],
      ['Total Moves', s.totalMoves || 0],
      ['Daily Streak', s.dailyStreak || 0],
    ];
    ctx.font = statSize + 'px system-ui, sans-serif';
    lines.forEach((line, i) => {
      const ly = h * 0.15 + i * (statSize + 10);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(line[0] + ':', leftX, ly);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(line[1]), leftX + (statSize * 8), ly);
    });

    // Bar chart showing recent games (placeholder rendering)
    const chartX = w * 0.1;
    const chartY = h * 0.7;
    const chartW = w * 0.8;
    const chartH = h * 0.12;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.font = (statSize - 2) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Recent Games', chartX + chartW / 2, chartY - 8);

    // Draw simple bars for last 10 games indication
    const barCount = Math.min(s.played, 10);
    if (barCount > 0) {
      const barWidth = (chartW - 20) / 10;
      for (let i = 0; i < barCount; i++) {
        const bx = chartX + 10 + i * barWidth;
        const bh = chartH * 0.6 * (0.4 + Math.random() * 0.6);
        ctx.fillStyle = (i < s.won && i < barCount) ? 'rgba(68,255,136,0.5)' : 'rgba(255,68,68,0.3)';
        ctx.fillRect(bx + 2, chartY + chartH - bh, barWidth - 4, bh);
      }
    }
  }

  _renderAchievements(ctx, w, h) {
    const titleSize = Math.min(w * 0.06, 32);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Achievements', w / 2, h * 0.05);

    const unlocked = this.achievementsData.unlocked || [];
    const total = Object.keys(ACHIEVEMENT_DEFS || {}).length || 26;
    ctx.font = (titleSize * 0.4) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(unlocked.length + '/' + total + ' unlocked', w / 2, h * 0.09);

    // Achievement grid
    const gridStartY = h * 0.2;
    const cols = Math.min(Math.floor(w / 70), 5);
    const cellSize = Math.min(w / (cols + 1), 60);
    const gridX = (w - cols * cellSize) / 2;
    const allAchievements = Object.keys(ACHIEVEMENT_DEFS || {});

    let row = 0; let col = 0;
    const maxVisible = Math.min(allAchievements.length, 15);
    for (let i = 0; i < maxVisible; i++) {
      const id = allAchievements[i];
      const isUnlocked = unlocked.includes(id);
      const ax = gridX + col * cellSize;
      const ay = gridStartY + row * cellSize;

      ctx.fillStyle = isUnlocked ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(ax + 4, ay + 4, cellSize - 8, cellSize - 8);
      ctx.strokeStyle = isUnlocked ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ax + 4, ay + 4, cellSize - 8, cellSize - 8);

      ctx.font = (cellSize * 0.4) + 'px system-ui, sans-serif';
      ctx.fillStyle = isUnlocked ? '#d4af37' : 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(isUnlocked ? '★' : '🔒', ax + cellSize / 2, ay + cellSize / 2);

      col++;
      if (col >= cols) { col = 0; row++; }
    }
  }

  _renderDailyChallenge(ctx, w, h) {
    const titleSize = Math.min(w * 0.06, 32);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Daily Challenge', w / 2, h * 0.08);

    // Streak display
    const streak = this.dailyData.streak || 0;
    ctx.font = 'bold ' + (titleSize * 1.5) + 'px system-ui, sans-serif';
    ctx.fillStyle = streak > 0 ? '#ff6600' : 'rgba(255,255,255,0.3)';
    ctx.fillText('🔥 ' + streak, w / 2, h * 0.2);
    ctx.font = (titleSize * 0.4) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Day Streak', w / 2, h * 0.27);

    // Calendar grid (current month)
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const calStartY = h * 0.33;
    const cellW = Math.min(w * 0.1, 32);
    const calW = cellW * 7;
    const calX = (w - calW) / 2;

    ctx.font = (cellW * 0.4) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const calendar = this.dailyData.calendar || [];

    for (let d = 1; d <= daysInMonth; d++) {
      const pos = d + firstDay - 1;
      const col = pos % 7;
      const row = Math.floor(pos / 7);
      const cx = calX + col * cellW + cellW / 2;
      const cy = calStartY + row * cellW + cellW / 2;

      const isCompleted = calendar.includes(d);
      const isToday = d === now.getDate();

      if (isCompleted) {
        ctx.fillStyle = 'rgba(68,255,136,0.3)';
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isToday) {
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = isCompleted ? '#44ff88' : (isToday ? '#d4af37' : 'rgba(255,255,255,0.5)');
      ctx.fillText(String(d), cx, cy);
    }

    // Longest streak
    ctx.font = (titleSize * 0.35) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Longest Streak: ' + (this.dailyData.longestStreak || streak), w / 2, h * 0.5);
  }

  _renderPause(ctx, w, h) {
    const titleSize = Math.min(w * 0.08, 40);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Paused', w / 2, h * 0.18);
  }

  _renderWin(ctx, w, h) {
    const titleSize = Math.min(w * 0.1, 52);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Victory!', w / 2, h * 0.12);

    const statSize = Math.min(w * 0.04, 20);
    ctx.font = statSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const d = this.winData;
    const timeStr = Math.floor((d.time || 0) / 60) + ':' + Math.floor((d.time || 0) % 60).toString().padStart(2, '0');
    ctx.fillText('Score: ' + (d.score || 0), w / 2, h * 0.25);
    ctx.fillText('Moves: ' + (d.moves || 0), w / 2, h * 0.32);
    ctx.fillText('Time: ' + timeStr, w / 2, h * 0.39);

    // XP earned bar
    if (this.progressionData) {
      const barW = Math.min(w * 0.5, 200);
      const barH = 8;
      const barX = (w - barW) / 2;
      const barY = h * 0.48;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      const progress = clamp((this.progressionData.xp || 0) / (this.progressionData.xpNext || 100), 0, 1);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(barX, barY, barW * progress, barH);
      ctx.font = (statSize * 0.7) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(212,175,55,0.7)';
      ctx.fillText('Level ' + (this.progressionData.level || 1), w / 2, barY + barH + 14);
    }
  }

  _renderGameOver(ctx, w, h) {
    const titleSize = Math.min(w * 0.08, 42);
    ctx.font = 'bold ' + titleSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', w / 2, h * 0.2);

    const statSize = Math.min(w * 0.04, 18);
    ctx.font = statSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#dddddd';
    ctx.fillText('Better luck next time!', w / 2, h * 0.35);
    ctx.fillText('Final Score: ' + (this.winData.score || 0), w / 2, h * 0.43);
  }

  _renderCoach() {
    if (!this.showCoach || this.coachDismissed) return;
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    const messages = [
      'Drag cards to move them between columns.',
      'Build tableau columns in alternating colors, descending rank.',
      'Move Aces to foundations, then build up by suit to King.',
      'Tap here to dismiss. Good luck!'
    ];

    const msg = messages[this.coachStep] || messages[messages.length - 1];
    const fontSize = Math.min(w * 0.04, 16);

    ctx.save();
    const boxW = Math.min(w * 0.8, 340);
    const boxH = fontSize + 40;
    const boxX = (w - boxW) / 2;
    const boxY = h * 0.45;

    ctx.fillStyle = 'rgba(10,26,15,0.95)';
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
    ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.font = fontSize + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, boxY + boxH / 2 - 6);
    ctx.font = (fontSize * 0.75) + 'px system-ui, sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Tap to continue (' + (this.coachStep + 1) + '/4)', w / 2, boxY + boxH - 12);
    ctx.restore();
  }
}
