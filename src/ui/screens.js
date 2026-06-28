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
import { drawFittedLabel, fitBoxLabel, wrapText, FONT_FAMILY } from './text-fit.js';

/**
 * Cohesive design system: deep-green felt, gold accents, soft glass panels.
 * Centralised so every screen shares the same palette, radii and spacing.
 */
export const UI = {
  gold: '#e8c662',
  goldSoft: 'rgba(232,198,98,0.55)',
  goldDim: 'rgba(232,198,98,0.18)',
  text: '#f3f1e9',
  textDim: 'rgba(243,241,233,0.62)',
  textFaint: 'rgba(243,241,233,0.4)',
  green: '#16633a',
  greenHi: '#1c7a48',
  panel: 'rgba(14,32,21,0.72)',
  panelBorder: 'rgba(255,255,255,0.10)',
  glassHi: 'rgba(255,255,255,0.08)',
  danger: '#ff6b6b',
  success: '#62e2a0',
  font: FONT_FAMILY,
};

/**
 * Responsive typography scale derived from the smaller viewport dimension so
 * text stays readable on phones and balanced on desktop.
 */
export function typeScale(w, h) {
  const k = Math.min(w, h * 0.85);
  return {
    title: clamp(k * 0.085, 22, 46),
    section: clamp(k * 0.055, 16, 30),
    body: clamp(k * 0.04, 12, 18),
    caption: clamp(k * 0.032, 10, 14),
  };
}

class ScreenButton {
  constructor(label, action, opts = {}) {
    this.label = label;
    this.action = action;
    this.x = 0; this.y = 0; this.width = 0; this.height = 0;
    this.hovered = false; this.pressed = false;
    this.enabled = opts.enabled !== false;
    this.secondary = opts.secondary || false;
    this.selected = opts.selected || false;
    this.toggle = opts.toggle || false;
    this.toggleState = opts.toggleState || false;
    this.slider = opts.slider || false;
    this.sliderValue = opts.sliderValue || 0;
    this.icon = opts.icon || '';
    this.maxFontSize = opts.maxFontSize || null;
    this.minFontSize = opts.minFontSize || 9;
    this.allowWrap = opts.allowWrap !== false;
    this.padX = opts.padX != null ? opts.padX : null;
    // Press animation (0..1), eased toward target each render.
    this._press = 0;
  }

  containsPoint(px, py) {
    return this.enabled && px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }

  /** The label as it will actually be drawn (with toggle/slider suffixes). */
  getDisplayLabel() {
    let displayLabel = this.label;
    if (this.toggle) displayLabel = `${this.label}: ${this.toggleState ? 'ON' : 'OFF'}`;
    if (this.slider) displayLabel = `${this.label}: ${Math.round(this.sliderValue * 100)}%`;
    return displayLabel;
  }

  /**
   * Fit options shared by the renderer and the automated overflow tests so the
   * test measures exactly what is drawn.
   */
  getFitOpts(baseSize) {
    const base = this.maxFontSize ? Math.min(baseSize, this.maxFontSize) : baseSize;
    // Sliders reserve vertical room for the progress bar, so fit text to the
    // upper portion of the box.
    const fitH = this.slider ? this.height * 0.78 : this.height;
    return {
      baseSize: base,
      minSize: this.minFontSize,
      allowWrap: this.allowWrap,
      maxLines: 2,
      weight: this.secondary && !this.selected ? '600' : 'bold',
      padX: this.padX != null ? this.padX : clamp(this.width * 0.08, 7, 16),
      boxH: fitH,
    };
  }

  render(ctx, fontSize) {
    const { x, y, width: w, height: h } = this;
    const r = clamp(h * 0.28, 8, 18);
    ctx.save();

    // Smooth press feedback.
    const pressTarget = this.pressed ? 1 : 0;
    this._press += (pressTarget - this._press) * 0.5;
    const scale = 1 - this._press * 0.04;
    if (scale !== 1) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    // Glass / neomorphism background.
    let bg, border, glow;
    if (!this.enabled) {
      bg = 'rgba(255,255,255,0.04)'; border = 'rgba(255,255,255,0.06)'; glow = null;
    } else if (this.selected) {
      bg = 'rgba(232,198,98,0.22)'; border = UI.gold; glow = UI.goldSoft;
    } else if (this.pressed) {
      bg = 'rgba(232,198,98,0.30)'; border = UI.goldSoft; glow = UI.goldSoft;
    } else if (this.secondary) {
      bg = this.hovered ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.06)';
      border = this.hovered ? UI.goldSoft : 'rgba(255,255,255,0.16)'; glow = null;
    } else {
      bg = this.hovered ? 'rgba(28,122,72,0.95)' : 'rgba(22,99,58,0.9)';
      border = this.hovered ? UI.goldSoft : 'rgba(255,255,255,0.14)';
      glow = this.hovered ? UI.goldDim : null;
    }

    // Drop shadow for elevation.
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = this.hovered ? 12 : 6;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = bg; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Soft outer glow on hover/selected.
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow; ctx.shadowBlur = 16;
      roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = glow; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    // Top glass highlight.
    if (this.enabled) {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(255,255,255,0.10)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = grad; ctx.fill();
    }

    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = border; ctx.lineWidth = this.selected ? 2 : 1; ctx.stroke();

    // Label (fitted so it can NEVER overflow or overlap neighbours).
    ctx.fillStyle = !this.enabled
      ? UI.textFaint
      : (this.selected ? UI.gold : (this.hovered ? UI.gold : UI.text));
    const opts = this.getFitOpts(fontSize);
    drawFittedLabel(ctx, this.getDisplayLabel(), x + w / 2, y + h / 2, w, opts.boxH, opts);

    // Slider bar.
    if (this.slider && this.enabled) {
      const barY = y + h - clamp(h * 0.16, 5, 8);
      const barW = w - 24;
      const barX = x + 12;
      const barH = 3;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();
      ctx.fillStyle = UI.gold;
      roundRect(ctx, barX, barY, Math.max(barH, barW * this.sliderValue), barH, barH / 2); ctx.fill();
      // Knob.
      ctx.beginPath();
      ctx.arc(barX + barW * this.sliderValue, barY + barH / 2, clamp(h * 0.1, 3, 5), 0, Math.PI * 2);
      ctx.fillStyle = UI.gold; ctx.fill();
    }

    ctx.restore();
  }
}

/** Rounded-rect path helper (kept local so ScreenButton has no renderer dep). */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
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
    this.dailyData = { completed: false, streak: 0, calendar: [], rewardAvailable: false };
    this.progressionData = { level: 1, xp: 0, xpNext: 100 };
    this.achievementCategory = 'all';
    this.dragSlider = null;
    // How-to-Play tutorial paging
    this.howToPlayPage = 0;
    this.howToPlayPageCount = 5;
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
      case 'howToPlay': this._renderHowToPlay(ctx, w, h); break;
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
        const items = [
          ['New Game', 'modeSelect'],
          ['Daily Challenge', 'dailyChallenge'],
          ['How to Play', 'howToPlay'],
          ['Continue', 'continue'],
          ['Statistics', 'statistics'],
          ['Achievements', 'achievements'],
          ['Settings', 'settings']
        ];
        // Fit-safe vertical layout: distribute within available band.
        const startY = h * 0.30;
        const endY = h * 0.95;
        const slot = (endY - startY) / items.length;
        const useH = Math.min(btnH, slot * 0.82);
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1]);
          btn.x = cx; btn.y = startY + i * slot + (slot - useH) / 2;
          btn.width = btnW; btn.height = useH;
          if (item[1] === 'continue') btn.enabled = this.hasSavedGame;
          this.buttons.push(btn);
        });
        break;
      }
      case 'modeSelect': {
        const content = this._content(w);
        const items = [
          ['Easy (Draw 1, Untimed)', 'startEasy'],
          ['Medium (Draw 1, Timed)', 'startMedium'],
          ['Hard (Draw 3, Untimed)', 'startHard'],
          ['Expert (Draw 3, Timed)', 'startExpert'],
          ['Back', 'back']
        ];
        const startY = h * 0.26;
        const endY = h * 0.94;
        const slot = (endY - startY) / items.length;
        const useH = clamp(Math.min(btnH, slot * 0.8), 22, 46);
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: item[1] === 'back' });
          btn.x = content.x; btn.y = startY + i * slot + (slot - useH) / 2;
          btn.width = content.width; btn.height = useH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'settings': {
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

        // Distribute all rows + the Back button within the available band so the
        // list always fits the screen (no off-screen rows on small phones).
        const content = this._content(w);
        const rowCount = settingsItems.length + 1; // + Back
        const startY = h * 0.155;
        const endY = h * 0.95;
        const slot = (endY - startY) / rowCount;
        const rowH = clamp(slot * 0.86, 18, 40);
        const colW = content.width;
        const colX = content.x;

        settingsItems.forEach((item, i) => {
          let opts = {};
          if (item.slider) opts = { slider: true, sliderValue: item.value };
          else if (item.toggle) opts = { toggle: true, toggleState: item.state };
          const displayLabel = item.display ? item.label + ': ' + item.display : item.label;
          const btn = new ScreenButton(item.slider ? item.label : displayLabel, item.action, opts);
          btn.x = colX; btn.y = startY + i * slot + (slot - rowH) / 2;
          btn.width = colW; btn.height = rowH;
          this.buttons.push(btn);
        });

        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = colX; backBtn.y = startY + settingsItems.length * slot + (slot - rowH) / 2;
        backBtn.width = colW; backBtn.height = rowH;
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
        const content = this._content(w);
        const tabY = h * 0.165;
        const tabH = clamp(btnH * 0.82, 30, 38);
        const cats = ['All', 'Beginner', 'Advanced', 'Special'];
        const tabGap = 8;
        const tabW = (content.width - tabGap * (cats.length - 1)) / cats.length;
        cats.forEach((cat, i) => {
          const isSel = cat.toLowerCase() === this.achievementCategory;
          const btn = new ScreenButton(cat, 'achCat_' + cat.toLowerCase(), {
            secondary: !isSel,
            selected: isSel,
            maxFontSize: 14,
            minFontSize: 8,
            allowWrap: false,
            padX: 5,
          });
          btn.x = content.x + i * (tabW + tabGap); btn.y = tabY;
          btn.width = tabW; btn.height = tabH;
          this.buttons.push(btn);
        });
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = cx; backBtn.y = h * 0.9; backBtn.width = btnW; backBtn.height = btnH;
        this.buttons.push(backBtn);
        break;
      }
      case 'dailyChallenge': {
        const content = this._content(w);
        const startY = h * 0.66;
        const slot = (h * 0.96 - startY) / 3;
        const useH = clamp(Math.min(btnH, slot * 0.82), 24, 44);
        const dailyLabel = this.dailyData.completed ? 'Completed!' : "Start Today's Challenge";
        const btn = new ScreenButton(dailyLabel, 'startDaily', { enabled: !this.dailyData.completed });
        btn.x = content.x; btn.y = startY; btn.width = content.width; btn.height = useH;
        this.buttons.push(btn);
        const rewardAvail = this.dailyData.rewardAvailable;
        const rewardBtn = new ScreenButton(rewardAvail ? 'Claim Daily Reward' : 'Reward Claimed', 'claimDailyReward', { enabled: rewardAvail });
        rewardBtn.x = content.x; rewardBtn.y = startY + slot; rewardBtn.width = content.width; rewardBtn.height = useH;
        this.buttons.push(rewardBtn);
        const backBtn = new ScreenButton('Back', 'back', { secondary: true });
        backBtn.x = content.x; backBtn.y = startY + 2 * slot; backBtn.width = content.width; backBtn.height = useH;
        this.buttons.push(backBtn);
        break;
      }
      case 'pause': {
        const startY = h * 0.28;
        const items = [['Resume', 'resume'], ['Restart', 'restart'], ['How to Play', 'howToPlay'], ['Settings', 'settings'], ['Quit to Menu', 'quit']];
        items.forEach((item, i) => {
          const btn = new ScreenButton(item[0], item[1], { secondary: item[1] === 'quit' });
          btn.x = cx; btn.y = startY + i * (btnH + gap);
          btn.width = btnW; btn.height = btnH;
          this.buttons.push(btn);
        });
        break;
      }
      case 'howToPlay': {
        // Bottom navigation row: Prev | Close | Next
        const navY = h * 0.88;
        const navW = (btnW - 2 * 8) / 3;
        const prevBtn = new ScreenButton('\u2190 Back', 'htpPrev', { secondary: true, enabled: this.howToPlayPage > 0 });
        prevBtn.x = cx; prevBtn.y = navY; prevBtn.width = navW; prevBtn.height = btnH;
        this.buttons.push(prevBtn);
        const closeBtn = new ScreenButton('Close', 'htpClose', { secondary: true });
        closeBtn.x = cx + navW + 8; closeBtn.y = navY; closeBtn.width = navW; closeBtn.height = btnH;
        this.buttons.push(closeBtn);
        const isLast = this.howToPlayPage >= this.howToPlayPageCount - 1;
        const nextBtn = new ScreenButton(isLast ? 'Done' : 'Next \u2192', isLast ? 'htpClose' : 'htpNext');
        nextBtn.x = cx + 2 * (navW + 8); nextBtn.y = navY; nextBtn.width = navW; nextBtn.height = btnH;
        this.buttons.push(nextBtn);
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

  // --- Design-system helpers (shared across screens) ---

  /** Centered content column metrics used to align headers, panels & buttons. */
  _content(w) {
    const width = Math.min(w * 0.88, 420);
    return { width, x: (w - width) / 2, cx: w / 2 };
  }

  /** A soft glass panel/card with rounded corners, subtle border and shadow. */
  _drawPanel(ctx, x, y, w, h, opts = {}) {
    const r = opts.radius != null ? opts.radius : 16;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = opts.elevation != null ? opts.elevation : 14;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = opts.fill || UI.panel;
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // Top glass sheen.
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(255,255,255,0.07)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.0)');
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = grad; ctx.fill();
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = opts.border || UI.panelBorder;
    ctx.lineWidth = opts.lineWidth || 1;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * A consistent screen header: gold title, optional subtitle and an underline
   * accent. Returns the y baseline below the header so callers can lay out the
   * body beneath it.
   */
  _drawHeader(ctx, w, h, title, subtitle) {
    const t = typeScale(w, h);
    const cx = w / 2;
    const titleY = h * 0.085;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${t.title}px ${UI.font}`;
    ctx.fillStyle = UI.gold;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText(title, cx, titleY);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // Accent underline.
    const uw = Math.min(w * 0.16, t.title * 2.2);
    ctx.fillStyle = UI.goldSoft;
    roundRect(ctx, cx - uw / 2, titleY + t.title * 0.62, uw, 2.5, 1.25);
    ctx.fill();
    let by = titleY + t.title * 0.62 + 6;
    if (subtitle) {
      ctx.font = `${t.caption}px ${UI.font}`;
      ctx.fillStyle = UI.textDim;
      by += t.caption + 6;
      ctx.fillText(subtitle, cx, by);
    }
    ctx.restore();
    return by + t.caption;
  }

  _renderLoading(ctx, w, h) {
    const t = this.loadTime * 2;
    const suits = ['\u2660', '\u2665', '\u2666', '\u2663'];
    const logoSize = Math.min(w * 0.12, 60);
    ctx.font = logoSize + 'px ' + UI.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    suits.forEach((s, i) => {
      const angle = t + (i * Math.PI / 2);
      const radius = logoSize * 0.8;
      const sx = w / 2 + Math.cos(angle) * radius;
      const sy = h * 0.35 + Math.sin(angle) * radius;
      ctx.fillStyle = (i === 1 || i === 2) ? '#d65151' : UI.text;
      ctx.fillText(s, sx, sy);
    });

    // Title
    const titleSize = Math.min(w * 0.08, 40);
    ctx.save();
    ctx.font = 'bold ' + titleSize + 'px ' + UI.font;
    ctx.fillStyle = UI.gold;
    ctx.shadowColor = 'rgba(232,198,98,0.3)'; ctx.shadowBlur = 16;
    ctx.fillText('Premium Solitaire', w / 2, h * 0.55);
    ctx.restore();

    // Progress bar
    const barW = Math.min(w * 0.6, 250);
    const barH = 6;
    const barX = (w - barW) / 2;
    const barY = h * 0.65;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();
    ctx.fillStyle = UI.gold;
    roundRect(ctx, barX, barY, Math.max(barH, barW * this.loadProgress), barH, barH / 2); ctx.fill();
  }

  _renderMainMenu(ctx, w, h) {
    const t = typeScale(w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Title with soft gold glow.
    ctx.save();
    ctx.font = `bold ${Math.min(t.title * 1.15, 52)}px ${UI.font}`;
    ctx.fillStyle = UI.gold;
    ctx.shadowColor = 'rgba(232,198,98,0.35)'; ctx.shadowBlur = 18;
    ctx.fillText('Premium Solitaire', w / 2, h * 0.135);
    ctx.restore();

    // Subtitle.
    ctx.font = `${t.caption}px ${UI.font}`;
    ctx.fillStyle = UI.textDim;
    ctx.fillText('Classic Klondike', w / 2, h * 0.135 + t.title * 0.7);

    // Level indicator chip.
    if (this.progressionData && this.progressionData.level > 1) {
      ctx.font = `${t.caption}px ${UI.font}`;
      ctx.fillStyle = UI.goldSoft;
      ctx.fillText('Level ' + this.progressionData.level, w / 2, h * 0.135 + t.title * 0.7 + t.caption + 8);
    }

    // Decorative suits near the bottom.
    ctx.font = `${t.section}px ${UI.font}`;
    ctx.fillStyle = 'rgba(232,198,98,0.16)';
    ctx.fillText('\u2660  \u2665  \u2666  \u2663', w / 2, h * 0.965);
  }

  _renderModeSelect(ctx, w, h) {
    this._drawHeader(ctx, w, h, 'Select Difficulty', 'Choose your challenge level');
  }

  _renderSettings(ctx, w, h) {
    this._drawHeader(ctx, w, h, 'Settings');
  }

  _renderStatistics(ctx, w, h) {
    const t = typeScale(w, h);
    this._drawHeader(ctx, w, h, 'Statistics');
    const content = this._content(w);

    const s = this.stats;
    const winPct = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0;
    const bestTimeStr = s.bestTime !== null ? Math.floor(s.bestTime / 60) + ':' + Math.floor(s.bestTime % 60).toString().padStart(2, '0') : '--:--';
    const avgTimeStr = s.averageTime !== null ? Math.floor(s.averageTime / 60) + ':' + Math.floor(s.averageTime % 60).toString().padStart(2, '0') : '--:--';

    // --- Win-rate panel with progress ring ---
    const topY = h * 0.17;
    const ringPanelH = clamp(h * 0.16, 96, 150);
    this._drawPanel(ctx, content.x, topY, content.width, ringPanelH);
    const ringX = content.x + ringPanelH * 0.5;
    const ringY = topY + ringPanelH / 2;
    const ringR = ringPanelH * 0.3;
    ctx.lineWidth = Math.max(4, ringR * 0.16);
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.stroke();
    ctx.beginPath();
    ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * winPct / 100));
    ctx.strokeStyle = UI.gold; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${t.section}px ${UI.font}`; ctx.fillStyle = UI.text;
    ctx.fillText(winPct + '%', ringX, ringY);
    ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textDim;
    ctx.fillText('Win Rate', ringX, ringY + ringR + t.caption + 2);

    // Headline counts to the right of the ring.
    const hx = content.x + ringPanelH + (content.width - ringPanelH) * 0.5;
    ctx.textAlign = 'center';
    ctx.font = `bold ${t.section * 1.05}px ${UI.font}`; ctx.fillStyle = UI.gold;
    ctx.fillText(`${s.won} / ${s.played}`, hx, ringY - t.caption);
    ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textDim;
    ctx.fillText('Games Won / Played', hx, ringY + t.caption);

    // --- Stats grid panel ---
    const gridY = topY + ringPanelH + 14;
    const rows = [
      ['Best Time', bestTimeStr], ['Avg Time', avgTimeStr],
      ['Current Streak', String(s.currentStreak || 0)], ['Longest Streak', String(s.longestStreak || 0)],
      ['Total Moves', String(s.totalMoves || 0)], ['Daily Streak', String(s.dailyStreak || 0)],
    ];
    const rowsPer = 2;
    const lineCount = Math.ceil(rows.length / rowsPer);
    const gridH = clamp(h * 0.30, 130, 260);
    this._drawPanel(ctx, content.x, gridY, content.width, gridH);
    const pad = 16;
    const colW = (content.width - pad * 2) / rowsPer;
    const lineH = (gridH - pad * 2) / lineCount;
    ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
      const c = i % rowsPer;
      const rr = Math.floor(i / rowsPer);
      const lx = content.x + pad + c * colW;
      const ly = gridY + pad + rr * lineH + lineH / 2;
      ctx.textAlign = 'left';
      ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textDim;
      ctx.fillText(row[0], lx, ly - t.body * 0.45);
      ctx.font = `bold ${t.body}px ${UI.font}`; ctx.fillStyle = UI.text;
      ctx.fillText(row[1], lx, ly + t.caption * 0.6);
    });

    // --- Recent-games bar chart panel ---
    const chartY = gridY + gridH + 14;
    const chartH = clamp(h * 0.13, 64, 120);
    if (chartY + chartH < h * 0.86) {
      this._drawPanel(ctx, content.x, chartY, content.width, chartH);
      ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textFaint;
      ctx.textAlign = 'left';
      ctx.fillText('Recent Games', content.x + pad, chartY + t.caption);
      const barCount = Math.min(s.played, 10);
      if (barCount > 0) {
        const innerW = content.width - pad * 2;
        const barWidth = innerW / 10;
        const winRatio = s.played > 0 ? s.won / s.played : 0;
        const baseY = chartY + chartH - 12;
        const maxBarH = chartH - t.caption - 22;
        for (let i = 0; i < barCount; i++) {
          const bx = content.x + pad + i * barWidth;
          const isWin = i < Math.round(barCount * winRatio);
          const bh = maxBarH * (isWin ? 0.95 : 0.5);
          ctx.fillStyle = isWin ? 'rgba(98,226,160,0.6)' : 'rgba(255,107,107,0.4)';
          roundRect(ctx, bx + 3, baseY - bh, barWidth - 6, bh, 3); ctx.fill();
        }
      }
    }
  }

  _renderAchievements(ctx, w, h) {
    const t = typeScale(w, h);
    const unlocked = this.achievementsData.unlocked || [];
    const allIds = Object.keys(ACHIEVEMENT_DEFS || {});
    const total = allIds.length || 26;
    this._drawHeader(ctx, w, h, 'Achievements', unlocked.length + ' / ' + total + ' unlocked');

    const content = this._content(w);
    // Filter by the selected category tab.
    const cat = this.achievementCategory || 'all';
    const visibleIds = allIds.filter(id => {
      if (cat === 'all') return true;
      const c = (ACHIEVEMENT_DEFS[id].category || '').toLowerCase();
      return c === cat;
    });

    // Responsive grid of framed cells.
    const gridTop = h * 0.235;
    const gridBottom = h * 0.86;
    const gridH = gridBottom - gridTop;
    const cols = clamp(Math.floor(content.width / 92), 3, 5);
    const gap = 10;
    const cellSize = Math.min((content.width - gap * (cols - 1)) / cols, gridH / 3.2);
    const gridX = content.x + (content.width - (cols * cellSize + (cols - 1) * gap)) / 2;
    const maxRows = Math.max(1, Math.floor((gridH + gap) / (cellSize + gap)));
    const maxVisible = Math.min(visibleIds.length, cols * maxRows);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < maxVisible; i++) {
      const id = visibleIds[i];
      const def = ACHIEVEMENT_DEFS[id];
      const isUnlocked = unlocked.includes(id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ax = gridX + col * (cellSize + gap);
      const ay = gridTop + row * (cellSize + gap);

      // Cell frame.
      this._drawPanel(ctx, ax, ay, cellSize, cellSize, {
        radius: 12,
        elevation: isUnlocked ? 12 : 6,
        fill: isUnlocked ? 'rgba(232,198,98,0.16)' : 'rgba(255,255,255,0.04)',
        border: isUnlocked ? UI.goldSoft : 'rgba(255,255,255,0.10)',
      });

      // Icon.
      ctx.font = `${cellSize * 0.36}px ${UI.font}`;
      ctx.fillStyle = isUnlocked ? UI.gold : 'rgba(243,241,233,0.28)';
      ctx.fillText(isUnlocked ? (def.icon || '\u2605') : '\uD83D\uDD12', ax + cellSize / 2, ay + cellSize * 0.4);

      // Short name, fitted so it never overflows the cell.
      ctx.fillStyle = isUnlocked ? UI.text : UI.textFaint;
      const nameOpts = { baseSize: cellSize * 0.16, minSize: 7, weight: '600', padX: 4, maxLines: 2 };
      drawFittedLabel(ctx, def.name || id, ax + cellSize / 2, ay + cellSize * 0.78, cellSize, cellSize * 0.4, nameOpts);
    }

    if (maxVisible === 0) {
      ctx.font = `${t.body}px ${UI.font}`; ctx.fillStyle = UI.textDim;
      ctx.fillText('No achievements in this category yet.', w / 2, gridTop + gridH * 0.3);
    }
  }

  _renderDailyChallenge(ctx, w, h) {
    const t = typeScale(w, h);
    this._drawHeader(ctx, w, h, 'Daily Challenge');
    const content = this._content(w);

    // Streak chip.
    const streak = this.dailyData.streak || 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${t.section * 1.1}px ${UI.font}`;
    ctx.fillStyle = streak > 0 ? '#ff8a3d' : UI.textFaint;
    ctx.fillText('\uD83D\uDD25 ' + streak, w / 2, h * 0.165);
    ctx.font = `${t.caption}px ${UI.font}`;
    ctx.fillStyle = UI.textDim;
    ctx.fillText('Day Streak  \u2022  Longest ' + (this.dailyData.longestStreak || streak), w / 2, h * 0.165 + t.section * 0.8);

    // Calendar panel sized to fit between the streak chip and the buttons.
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    const calendar = this.dailyData.calendar || [];
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    const rowsNeeded = weeks + 1; // + weekday header row

    const calTop = h * 0.24;
    const calBottom = h * 0.6;
    const cellW = clamp(Math.min(content.width / 7, (calBottom - calTop) / rowsNeeded), 16, 40);
    const calW = cellW * 7;
    const calX = (w - calW) / 2;
    const panelPad = 10;
    this._drawPanel(ctx, calX - panelPad, calTop - panelPad, calW + panelPad * 2, cellW * rowsNeeded + panelPad * 2, { radius: 14 });

    // Weekday header.
    const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    ctx.font = `${cellW * 0.34}px ${UI.font}`;
    ctx.fillStyle = UI.textFaint;
    for (let i = 0; i < 7; i++) {
      ctx.fillText(dow[i], calX + i * cellW + cellW / 2, calTop + cellW * 0.5);
    }

    ctx.font = `${cellW * 0.36}px ${UI.font}`;
    for (let d = 1; d <= daysInMonth; d++) {
      const pos = d + firstDay - 1;
      const col = pos % 7;
      const row = Math.floor(pos / 7) + 1; // +1 for header row
      const ccx = calX + col * cellW + cellW / 2;
      const ccy = calTop + row * cellW + cellW / 2;
      const isCompleted = calendar.includes(d);
      const isToday = d === now.getDate();
      if (isCompleted) {
        ctx.beginPath(); ctx.arc(ccx, ccy, cellW * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(98,226,160,0.28)'; ctx.fill();
      }
      if (isToday) {
        ctx.beginPath(); ctx.arc(ccx, ccy, cellW * 0.38, 0, Math.PI * 2);
        ctx.strokeStyle = UI.gold; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.fillStyle = isCompleted ? UI.success : (isToday ? UI.gold : UI.textDim);
      ctx.fillText(String(d), ccx, ccy);
    }
  }

  _renderHowToPlay(ctx, w, h) {
    const page = this.howToPlayPage || 0;
    const t = typeScale(w, h);
    const content = this._content(w);
    const titles = ['The Goal', 'The 7 Columns', 'The 4 Foundations', 'Deck & Waste', 'Scoring & Tips'];

    // Header + page subtitle.
    this._drawHeader(ctx, w, h, 'How to Play', 'Step ' + (page + 1) + ' of ' + this.howToPlayPageCount + '  \u2022  ' + (titles[page] || ''));

    // Page dots.
    const dotY = h * 0.165;
    const dotR = Math.max(3, w * 0.008);
    const dotGap = dotR * 3.6;
    const totalW = (this.howToPlayPageCount - 1) * dotGap;
    for (let i = 0; i < this.howToPlayPageCount; i++) {
      ctx.beginPath();
      ctx.arc(w / 2 - totalW / 2 + i * dotGap, dotY, i === page ? dotR * 1.15 : dotR, 0, Math.PI * 2);
      ctx.fillStyle = i === page ? UI.gold : 'rgba(255,255,255,0.22)';
      ctx.fill();
    }

    // Content panel.
    const panelTop = h * 0.2;
    const panelBottom = h * 0.83;
    this._drawPanel(ctx, content.x, panelTop, content.width, panelBottom - panelTop, { radius: 16 });

    const cw = clamp(Math.min(w * 0.13, content.width * 0.16), 30, 54);
    const ch = cw * 1.4;
    const midX = w / 2;
    const diagramY = panelTop + (panelBottom - panelTop) * 0.08;
    const bodySize = clamp(t.body, 12, 17);
    const maxW = content.width - 36;

    // Render a list of sentences/bullets, auto-wrapped so nothing overflows.
    const drawBody = (sentences, startY, opts = {}) => {
      const size = opts.size || bodySize;
      const weight = opts.weight || '500';
      const align = opts.align || 'center';
      const x = align === 'left' ? content.x + 20 : midX;
      ctx.textAlign = align; ctx.textBaseline = 'middle';
      let y = startY;
      for (const s of sentences) {
        if (s === '') { y += size * 0.6; continue; }
        const head = typeof s === 'object';
        const text = head ? s.text : s;
        const col = head ? s.color : (opts.color || UI.text);
        const wt = head ? (s.weight || 'bold') : weight;
        const lineW = align === 'left' ? maxW - 14 : maxW;
        const wrapped = wrapText(ctx, text, lineW, size, wt);
        ctx.font = `${wt} ${size}px ${UI.font}`;
        ctx.fillStyle = col;
        for (const ln of wrapped) {
          if (align === 'left' && /^\u2022/.test(ln)) {
            ctx.fillText(ln, x, y);
          } else {
            ctx.fillText(ln, x, y);
          }
          y += size * 1.45;
        }
      }
      return y;
    };

    if (page === 0) {
      const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
      const totalCardsW = 4 * cw + 3 * 10;
      let fx = midX - totalCardsW / 2;
      for (let i = 0; i < 4; i++) {
        this._drawMiniCard(ctx, fx, diagramY, cw, ch, i === 0 ? 'A' : 'K', suits[i], true);
        fx += cw + 10;
      }
      drawBody([
        { text: 'Win by moving all 52 cards onto the four foundation piles at the top.', color: UI.text },
        'Each foundation collects ONE suit and is built up in order: Ace first, then 2, 3, 4 ... all the way to King.',
        { text: 'Fill all four and you win the game!', color: UI.gold },
      ], diagramY + ch + 28);
    } else if (page === 1) {
      const startY = diagramY;
      this._drawMiniCard(ctx, midX - cw / 2, startY, cw, ch, '8', 'hearts', true);
      this._drawMiniCard(ctx, midX - cw / 2, startY + ch * 0.34, cw, ch, '7', 'spades', true);
      this._drawMiniCard(ctx, midX - cw / 2, startY + ch * 0.68, cw, ch, '6', 'diamonds', true);
      drawBody([
        { text: 'These are the 7 columns in the middle of the board.', color: UI.text },
        'Stack cards DOWNWARD and in ALTERNATING colours - a red card on a black card, then black on red (e.g. red 8, black 7, red 6).',
        'You can move one card or a whole ordered run together.',
        { text: 'An empty column can only be started with a King.', color: UI.gold },
      ], startY + ch * 0.68 + ch + 22);
    } else if (page === 2) {
      const totalCardsW = 3 * cw + 2 * 12;
      let fx = midX - totalCardsW / 2;
      ['A', '2', '3'].forEach((rk) => {
        this._drawMiniCard(ctx, fx, diagramY, cw, ch, rk, 'spades', true);
        fx += cw + 12;
      });
      drawBody([
        { text: 'The four piles at the top-right corner.', color: UI.text },
        'Each one starts with an Ace, then takes the SAME suit in climbing order: A, 2, 3 ... up to Queen and King.',
        { text: 'Shortcut: double-tap any card to fly it to its foundation.', color: UI.gold },
      ], diagramY + ch + 28);
    } else if (page === 3) {
      this._drawMiniCard(ctx, midX - cw - 18, diagramY, cw, ch, '', 'spades', false);
      this._drawMiniCard(ctx, midX + 18, diagramY, cw, ch, '9', 'clubs', true);
      ctx.font = `${bodySize * 0.85}px ${UI.font}`;
      ctx.fillStyle = UI.textDim;
      ctx.textAlign = 'center';
      ctx.fillText('Stock', midX - cw / 2 - 18, diagramY + ch + 14);
      ctx.fillText('Waste', midX + 18 + cw / 2, diagramY + ch + 14);
      drawBody([
        { text: 'Stock = the face-down deck (top-left). Waste = the pile next to it.', color: UI.text },
        'Tap the stock to flip cards onto the waste, then play the top waste card onto a column or foundation.',
        { text: 'When the stock runs out, tap it again to recycle the waste.', color: UI.gold },
      ], diagramY + ch + 34);
    } else {
      drawBody([
        { text: 'Scoring (Standard)', color: UI.gold },
        '\u2022 +10 for moving a card to a foundation',
        '\u2022 +5 for revealing a hidden card',
        '\u2022 Bonus points for finishing fast',
        '',
        { text: 'Handy Tips', color: UI.gold },
        '\u2022 Tap a card, then tap where it should go.',
        '\u2022 Stuck? Press the \u2728 Hint button for a move.',
        '\u2022 An Auto button appears when a win is certain.',
        '\u2022 Undo and redo as much as you like - plan ahead!',
      ], panelTop + 34, { align: 'left' });
    }
  }

  /**
   * Draw a small decorative card for tutorial diagrams.
   */
  _drawMiniCard(ctx, x, y, w, h, rank, suit, faceUp) {
    const r = Math.min(w * 0.12, 7);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    if (faceUp) {
      path(); ctx.fillStyle = '#fdfdfd'; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      const red = (suit === 'hearts' || suit === 'diamonds');
      const sym = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' }[suit];
      ctx.fillStyle = red ? '#cc1133' : '#1a1a1a';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      if (rank) {
        ctx.font = 'bold ' + (w * 0.34) + 'px system-ui, sans-serif';
        ctx.fillText(rank, x + w * 0.12, y + h * 0.06);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = (w * 0.5) + 'px system-ui, sans-serif';
      ctx.fillText(sym, x + w / 2, y + h * 0.58);
    } else {
      path();
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#2a5aab'); g.addColorStop(1, '#1a3a6b');
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
      const inset = w * 0.16;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    }
    ctx.restore();
  }

  _renderPause(ctx, w, h) {
    const t = typeScale(w, h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(t.title * 1.05, 44)}px ${UI.font}`;
    ctx.fillStyle = UI.text;
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8;
    ctx.fillText('Paused', w / 2, h * 0.17);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    const uw = Math.min(w * 0.14, 70);
    ctx.fillStyle = UI.goldSoft;
    roundRect(ctx, w / 2 - uw / 2, h * 0.17 + t.title * 0.6, uw, 2.5, 1.25); ctx.fill();
  }

  _renderWin(ctx, w, h) {
    const t = typeScale(w, h);
    const content = this._content(w);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.font = `bold ${Math.min(t.title * 1.25, 54)}px ${UI.font}`;
    ctx.fillStyle = UI.gold;
    ctx.shadowColor = 'rgba(232,198,98,0.4)'; ctx.shadowBlur = 20;
    ctx.fillText('Victory!', w / 2, h * 0.13);
    ctx.restore();

    // Stats panel.
    const d = this.winData;
    const timeStr = Math.floor((d.time || 0) / 60) + ':' + Math.floor((d.time || 0) % 60).toString().padStart(2, '0');
    const panelY = h * 0.22;
    const panelH = clamp(h * 0.2, 110, 180);
    this._drawPanel(ctx, content.x, panelY, content.width, panelH);
    const stats = [['Score', String(d.score || 0)], ['Moves', String(d.moves || 0)], ['Time', timeStr]];
    const colW = content.width / 3;
    stats.forEach((st, i) => {
      const sx = content.x + colW * i + colW / 2;
      ctx.font = `bold ${t.section}px ${UI.font}`; ctx.fillStyle = UI.text;
      ctx.fillText(st[1], sx, panelY + panelH * 0.4);
      ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textDim;
      ctx.fillText(st[0], sx, panelY + panelH * 0.68);
    });

    // XP bar.
    if (this.progressionData) {
      const barW = content.width * 0.8;
      const barH = 8;
      const barX = (w - barW) / 2;
      const barY = panelY + panelH + h * 0.05;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, barX, barY, barW, barH, barH / 2); ctx.fill();
      const progress = clamp((this.progressionData.progress != null ? this.progressionData.progress : (this.progressionData.xp || 0) / (this.progressionData.xpNext || 100)), 0, 1);
      ctx.fillStyle = UI.gold;
      roundRect(ctx, barX, barY, Math.max(barH, barW * progress), barH, barH / 2); ctx.fill();
      ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.goldSoft;
      ctx.fillText('Level ' + (this.progressionData.level || 1), w / 2, barY + barH + t.caption);
    }
  }

  _renderGameOver(ctx, w, h) {
    const t = typeScale(w, h);
    const content = this._content(w);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.font = `bold ${Math.min(t.title * 1.05, 44)}px ${UI.font}`;
    ctx.fillStyle = UI.danger;
    ctx.shadowColor = 'rgba(255,107,107,0.35)'; ctx.shadowBlur = 14;
    ctx.fillText('Game Over', w / 2, h * 0.2);
    ctx.restore();

    ctx.font = `${t.body}px ${UI.font}`; ctx.fillStyle = UI.textDim;
    ctx.fillText('Better luck next time!', w / 2, h * 0.3);

    const panelY = h * 0.36;
    const panelH = clamp(h * 0.1, 56, 90);
    this._drawPanel(ctx, content.x, panelY, content.width, panelH);
    ctx.font = `bold ${t.section}px ${UI.font}`; ctx.fillStyle = UI.text;
    ctx.fillText(String(this.winData.score || 0), w / 2, panelY + panelH * 0.42);
    ctx.font = `${t.caption}px ${UI.font}`; ctx.fillStyle = UI.textDim;
    ctx.fillText('Final Score', w / 2, panelY + panelH * 0.72);
  }

  _renderCoach() {
    if (!this.showCoach || this.coachDismissed) return;
    const ctx = this.renderer.ctx;
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    const t = typeScale(w, h);

    const messages = [
      'Drag a card to move it between columns.',
      'Build columns down in rank with alternating colours.',
      'Send Aces to the foundations, then build up by suit to the King.',
      'Tap anywhere to dismiss. Good luck!'
    ];
    const msg = messages[this.coachStep] || messages[messages.length - 1];

    ctx.save();
    const boxW = Math.min(w * 0.84, 360);
    const boxH = clamp(h * 0.16, 96, 130);
    const boxX = (w - boxW) / 2;
    const boxY = h * 0.42;

    this._drawPanel(ctx, boxX, boxY, boxW, boxH, { radius: 16, fill: 'rgba(10,26,15,0.96)', border: UI.goldSoft });

    // Gold tip dot.
    ctx.beginPath();
    ctx.arc(boxX + boxW / 2, boxY + boxH * 0.2, 4, 0, Math.PI * 2);
    ctx.fillStyle = UI.gold; ctx.fill();

    ctx.fillStyle = UI.text;
    drawFittedLabel(ctx, msg, w / 2, boxY + boxH * 0.52, boxW - 24, boxH * 0.5, {
      baseSize: t.body, minSize: 11, weight: '600', maxLines: 3, padX: 12,
    });

    ctx.font = `${t.caption}px ${UI.font}`;
    ctx.fillStyle = UI.textFaint;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Tap to continue  (' + (this.coachStep + 1) + '/4)', w / 2, boxY + boxH - t.caption);
    ctx.restore();
  }
}
