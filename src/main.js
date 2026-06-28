/**
 * Main boot module: Premium App class with responsive layout engine,
 * layered render pipeline, game state management, keyboard shortcuts,
 * PWA install prompt, and all integrations.
 */

import { GameLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { Renderer } from './core/render.js';
import { Audio } from './core/audio.js';
import { Game, GAME_STATES, DIFFICULTY, SCORING_MODE } from './game/game.js';
import { DragSystem } from './game/drag.js';
import { setCardTheme } from './game/card.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { ParticleSystem } from './ui/particles.js';
import { AnimationManager } from './ui/animations.js';
import { getAdapter } from './platform/index.js';
import { SaveManager, SAVE_KEYS } from './systems/save-manager.js';
import { Progression, calculateGameXp } from './systems/progression.js';
import { DailyChallenge } from './systems/daily-challenge.js';
import { Achievements } from './systems/achievements.js';
import { SCORING } from './config/scoring.js';
import { THEMES, DEFAULT_THEME, TABLE_THEMES, isThemeUnlocked } from './config/themes.js';

const SAVE_KEY_STATS = 'solitaire_stats';
const SAVE_KEY_SETTINGS = 'solitaire_settings';
const SAVE_KEY_COACH = 'solitaire_coach_seen';

class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.loop = new GameLoop();
    this.adapter = getAdapter();
    this.saveManager = new SaveManager(this.adapter);
    this.particles = new ParticleSystem();
    this.animations = new AnimationManager();

    // Systems
    this.progression = new Progression();
    this.dailyChallenge = new DailyChallenge();
    this.achievements = new Achievements();

    // Load all persisted state
    this._loadAllState();

    // Load settings
    this.settings = this._loadSettings();

    this.game = new Game({
      drawCount: this.settings.drawMode || 1,
      audio: this.audio
    });

    this.hud = new HUD(this.game, this.renderer);
    this.screens = new Screens(this.renderer, this.audio);
    this.screens.setSettings(this.settings);

    this.layout = {
      cardWidth: 70, cardHeight: 100,
      marginX: 10, marginY: 10, colGap: 10, wasteGap: 12,
      stackOffsetY: 20, stackOffsetFaceDown: 5,
      topRowY: 55, tableauY: 180, padding: 10, hudBarH: 50
    };

    this.audioInitialized = false;
    this.gameActive = false;
    this.showingWinAnim = false;
    this.usedUndoThisGame = false;
    this.isDailyChallenge = false;
    this.deferredInstallPrompt = null;

    // Hint highlight, tap-to-move selection, toasts, invalid-move flash
    this.hint = { active: false, time: 0, duration: 1.8, data: null, isStock: false };
    this.selectedSource = null;
    this.selectedCards = null;
    this._toasts = [];
    this._invalidFlash = null;
    this._pointerDown = null;
    this._htpReturn = 'mainMenu';

    // Stats
    this.stats = this._loadStats();
    this.screens.setStats(this.stats);

    // Sync system state to screens
    this._syncScreenState();

    // Apply theme
    setCardTheme(this.settings.cardTheme);

    // Game callbacks
    this.game.onWin = (score, moves, time) => {
      this.showingWinAnim = true;
      this.particles.emit('winCelebration', this.renderer.logicalWidth / 2, this.renderer.logicalHeight * 0.3);
      setTimeout(() => {
        this.screens.show('win', { score, moves, time });
        this._recordWin(time, moves);
      }, 3000);
    };

    this.game.onLose = () => {
      this.screens.show('gameOver', { score: this.game.score });
      this._recordLoss();
    };

    this._initApp();
  }

  _loadAllState() {
    const savedData = this.saveManager.loadAll();
    this.progression.loadState(savedData.progression);
    this.dailyChallenge.loadState(savedData.daily);
    this.achievements.loadState(savedData.achievements);
  }

  _saveAllState() {
    this.saveManager.saveAll({
      stats: this.stats,
      progression: this.progression.getState(),
      achievements: this.achievements.getState(),
      daily: this.dailyChallenge.getState()
    });
    this._syncScreenState();
  }

  _syncScreenState() {
    if (!this.screens) return;
    // Push daily challenge data
    if (this.screens.setDailyData) {
      this.screens.setDailyData({
        streak: this.dailyChallenge.getStreak(),
        completed: this.dailyChallenge.isCompleted(),
        calendar: this.dailyChallenge.getCalendarMonth ? this.dailyChallenge.getCalendarMonth(new Date().getFullYear(), new Date().getMonth()) : [],
        totalCompleted: this.dailyChallenge.totalCompleted || 0,
        rewardAvailable: this._isDailyRewardAvailable ? this._isDailyRewardAvailable() : false
      });
    }
    // Push achievements data
    if (this.screens.setAchievements) {
      this.screens.setAchievements({
        unlocked: this.achievements.getUnlocked(),
        progress: this.achievements.getProgress ? this.achievements.getProgress(this.stats) : []
      });
    }
    // Push progression data
    if (this.screens.setProgression) {
      this.screens.setProgression({
        level: this.progression.getLevel(),
        xp: this.progression.xp,
        progress: this.progression.getLevelProgress(),
        currency: this.progression.currency
      });
    }
  }

  _loadSettings() {
    const saved = this.saveManager.load(SAVE_KEY_SETTINGS);
    return {
      soundEnabled: saved ? saved.soundEnabled !== false : true,
      musicEnabled: saved ? saved.musicEnabled !== false : true,
      cardTheme: saved ? (saved.cardTheme || DEFAULT_THEME) : DEFAULT_THEME,
      drawMode: saved ? (saved.drawMode || 1) : 1,
      sfxVolume: saved ? (saved.sfxVolume !== undefined ? saved.sfxVolume : 0.8) : 0.8,
      musicVolume: saved ? (saved.musicVolume !== undefined ? saved.musicVolume : 0.5) : 0.5,
      animationSpeed: saved ? (saved.animationSpeed || 'normal') : 'normal',
      autoComplete: saved ? (saved.autoComplete !== false) : true,
      hintFrequency: saved ? (saved.hintFrequency || 'subtle') : 'subtle',
      cardSize: saved ? (saved.cardSize || 'medium') : 'medium',
      leftHand: saved ? (saved.leftHand || false) : false,
      themeMode: saved ? (saved.themeMode || 'dark') : 'dark',
      tableFelt: saved ? (saved.tableFelt || 'green') : 'green',
      cardFaceStyle: saved ? (saved.cardFaceStyle || 'classic') : 'classic',
      reducedMotion: saved ? (saved.reducedMotion || false) : false,
      scoringMode: saved ? (saved.scoringMode || 'standard') : 'standard'
    };
  }

  _saveSettings() {
    this.saveManager.save(SAVE_KEY_SETTINGS, this.settings);
  }

  _loadStats() {
    const saved = this.saveManager.load(SAVE_KEY_STATS);
    return saved || {
      played: 0, won: 0, bestTime: null, averageTime: null,
      currentStreak: 0, longestStreak: 0, longestWinStreak: 0,
      totalMoves: 0, hardModeWins: 0, perfectWins: 0,
      bestMoves: null, dailyChallengesCompleted: 0, dailyStreak: 0,
      minimalistAchieved: false, bestScore: 0, averageScore: 0
    };
  }

  _saveStats() { this.saveManager.save(SAVE_KEY_STATS, this.stats); }

  _recordWin(time, moves) {
    this.stats.played++;
    this.stats.won++;
    this.stats.currentStreak++;
    this.stats.totalMoves += moves || 0;
    if (this.stats.currentStreak > this.stats.longestStreak) this.stats.longestStreak = this.stats.currentStreak;
    if (this.stats.currentStreak > (this.stats.longestWinStreak || 0)) this.stats.longestWinStreak = this.stats.currentStreak;
    if (this.stats.bestTime === null || time < this.stats.bestTime) this.stats.bestTime = time;
    const totalWins = this.stats.won;
    this.stats.averageTime = this.stats.averageTime === null ? time : ((this.stats.averageTime * (totalWins - 1)) + time) / totalWins;
    if (moves && (this.stats.bestMoves === null || moves < this.stats.bestMoves)) { this.stats.bestMoves = moves; this.stats.minimalistAchieved = true; }
    if (this.game && this.game.hardMode) this.stats.hardModeWins = (this.stats.hardModeWins || 0) + 1;
    if (!this.usedUndoThisGame) this.stats.perfectWins = (this.stats.perfectWins || 0) + 1;
    if (this.isDailyChallenge) {
      const result = this.dailyChallenge.complete();
      this.stats.dailyChallengesCompleted = this.dailyChallenge.totalCompleted;
      this.stats.dailyStreak = result.newStreak;
    }
    const xp = calculateGameXp({ won: true, time, usedUndo: this.usedUndoThisGame, streak: this.dailyChallenge.getStreak() });
    this.progression.addXp(xp);
    this.achievements.check(this.stats);
    this._saveStats(); this._saveAllState(); this.screens.setStats(this.stats);
  }

  _recordLoss() {
    this.stats.played++;
    this.stats.currentStreak = 0;
    this.stats.totalMoves += (this.game ? this.game.moves : 0);
    const xp = calculateGameXp({ won: false, time: this.game ? this.game.timer : 0, usedUndo: this.usedUndoThisGame, streak: 0 });
    this.progression.addXp(xp);
    this.achievements.check(this.stats);
    this._saveStats(); this._saveAllState(); this.screens.setStats(this.stats);
  }

  _initApp() {
    if (this.saveManager.hasSavedGame()) this.screens.setHasSavedGame(true);
    this.screens.show('mainMenu');

    this.input.on('pointerdown', (coords) => this._onPointerDown(coords));
    this.input.on('pointermove', (coords) => this._onPointerMove(coords));
    this.input.on('pointerup', (coords) => this._onPointerUp(coords));
    this.input.on('doubletap', (coords) => this._onDoubleTap(coords));
    this.input.on('shortcut', (e) => this._onKeyboard(e));

    // Visibility API for auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.gameActive && this.game.state === GAME_STATES.PLAYING) {
        this.game.state = GAME_STATES.PAUSED;
        this.screens.show('pause');
      }
    });

    // Save on unload
    window.addEventListener('beforeunload', () => {
      if (this.gameActive && this.game && this.game.state === GAME_STATES.PLAYING) this._saveGameState();
    });

    // Orientation/resize
    window.addEventListener('resize', () => { this._feltCanvas = null; this._computeLayout(); });

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
    });

    this.loop.start((dt) => this._update(dt), (dt) => this._render(dt));
  }

  _onDoubleTap(coords) {
    if (!this.gameActive || this.game.state !== GAME_STATES.PLAYING) return;
    this._ensureAudio();
    this._clearSelection();
    // Resolve tap coordinates to the card at that position
    const card = this._findCardAt(coords.x, coords.y);
    if (card && card.faceUp && this.game.autoMoveToFoundation) {
      const moved = this.game.autoMoveToFoundation(card);
      if (moved) {
        this._positionCards();
        this.audio.play('cardPlace');
      }
    }
  }

  _findCardAt(x, y) {
    const layout = this.layout;
    // Check waste pile top card
    const wasteCard = this.game.stock.topWaste();
    if (wasteCard && wasteCard.containsPoint(x, y)) return wasteCard;
    // Check tableau columns (top to bottom for overlap)
    for (let col = 6; col >= 0; col--) {
      const column = this.game.tableau.columns[col];
      for (let i = column.length - 1; i >= 0; i--) {
        const card = column[i];
        if (!card.faceUp) continue;
        if (card.containsPoint(x, y)) return card;
      }
    }
    return null;
  }

  _onKeyboard(e) {
    if (!this.gameActive) return;
    switch (e.action) {
      case 'undo': this.game.undo(); this.usedUndoThisGame = true; this._positionCards(); break;
      case 'redo': if (this.game.redo) this.game.redo(); this._positionCards(); break;
      case 'hint': this._activateHint(); break;
      case 'newGame': this._handleScreenAction('modeSelect'); break;
      case 'autoComplete': if (this.game.canAutoComplete && this.game.canAutoComplete()) this.game.startAutoComplete(); break;
      case 'pause':
        if (this.screens.isActive()) this._handleScreenAction('resume');
        else { this.game.state = GAME_STATES.PAUSED; this.screens.show('pause'); }
        break;
      case 'toggle': this.game.drawFromStock(); this._positionCards(); break;
    }
  }

  _startNewGame(hardMode, options = {}) {
    const drawCount = options.drawCount || (hardMode ? 3 : this.settings.drawMode);
    const difficulty = options.difficulty || (hardMode ? (drawCount === 3 ? DIFFICULTY.EXPERT : DIFFICULTY.MEDIUM) : (drawCount === 3 ? DIFFICULTY.HARD : DIFFICULTY.EASY));
    const scoringMode = options.scoringMode || this.settings.scoringMode || SCORING_MODE.STANDARD;
    this.game = new Game({
      drawCount,
      difficulty,
      scoringMode,
      audio: this.audio,
      hardMode,
      hardModeTime: hardMode ? (drawCount === 3 ? 300 : 600) : 0,
      seed: options.seed || null
    });
    this.game.onWin = (score, moves, time) => {
      this.showingWinAnim = true;
      this.particles.emit('winCelebration', this.renderer.logicalWidth / 2, this.renderer.logicalHeight * 0.3);
      setTimeout(() => { this.screens.show('win', { score, moves, time }); this._recordWin(time, moves); }, 3000);
    };
    this.game.onLose = () => { this.screens.show('gameOver', { score: this.game.score }); this._recordLoss(); };
    this.game.deal();
    this.hud = new HUD(this.game, this.renderer);
    this.hud.lastScore = 0;
    this.hud.setStreak(this.dailyChallenge.getStreak());
    this._computeLayout();
    this._positionCards();
    this.gameActive = true;
    this.showingWinAnim = false;
    this.usedUndoThisGame = false;
    this.isDailyChallenge = options.isDaily || false;
    this.screens.hide();
    this.particles.clear();
    this.hint.active = false;
    this._clearSelection();
    this._invalidFlash = null;
    this._toasts = [];

    const coachSeen = this.saveManager.load(SAVE_KEY_COACH);
    if (!coachSeen) { this.screens.showCoachMarks(); this.saveManager.save(SAVE_KEY_COACH, true); }
  }

  /**
   * Responsive board layout engine.
   *
   * Card size is derived from BOTH constraints and the smallest is taken:
   *   - width  : 7 columns + 6 inter-column gaps + 2 side margins must fit `w`
   *   - height : HUD bar + top margin + foundations/stock row + row gap +
   *              a reference tableau column (6 face-down + 1 face-up, the
   *              tallest at deal time) must fit `h`
   *   - cap    : a viewport-scaled maximum so cards never become absurd on
   *              large desktops / ultrawide.
   *
   * Gaps and margins are proportional to the viewport (no hard-coded 80/10/20/55).
   *
   * Vertically the whole playfield block (top row + row gap + the *live*
   * tallest column) is centred in the space under the HUD so it fills the
   * screen and stays balanced instead of being pinned to the top. As columns
   * grow during play the block rises toward a comfortable top anchor, and the
   * face-up/face-down fan offsets shrink (clamped) so the tallest column can
   * never overflow past the bottom.
   */
  _computeLayout() {
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    const ASPECT = 100 / 70;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // --- HUD bar height (mirrors HUD.render so the board never overlaps it) ---
    const isSmall = w < 500;
    const hudBarH = (isSmall ? 28 : 34) + 16; // 44 (mobile) / 50 (larger)
    this.layout.hudBarH = hudBarH;

    // --- Proportional horizontal gaps & margins ---
    const colGap = clamp(Math.round(w * 0.018), 4, 16);
    const sideMargin = clamp(Math.round(w * 0.03), 6, 64);
    this.layout.colGap = colGap;
    this.layout.wasteGap = colGap;

    // --- Fan ratios (relative to card height) ---
    const FD_RATIO = 0.20;   // compact face-down offset
    const FU_RATIO = 0.34;   // generous face-up fan offset
    const ROWGAP_RATIO = 0.42;

    // --- Width-constrained card width ---
    const cwWidth = (w - 2 * sideMargin - 6 * colGap) / 7;

    // --- Vertical budget ---
    const topPad = clamp(Math.round(h * 0.015), 6, 24);
    const bottomMargin = clamp(Math.round(h * 0.022), 8, 48);
    const playTop = hudBarH + topPad;          // earliest the top row may start
    const availH = h - playTop - bottomMargin; // space available for the board block

    // --- Height-constrained card width (uses a STABLE reference column so the
    //     card size does not jump around as columns grow during play) ---
    const refColFactor = 1 + 6 * FD_RATIO;     // 6 face-down + 1 face-up top card
    const refBlockFactor = 1 + ROWGAP_RATIO + refColFactor; // top row + gap + column
    const cwHeight = (availH / refBlockFactor) / ASPECT;

    // --- Viewport-scaled maximum (generous on mobile, bounded on big screens) ---
    const cap = clamp(Math.min(w, h) * 0.20, 64, 124);

    const cardWidth = clamp(Math.min(cwWidth, cwHeight, cap), 20, 400);
    const cardHeight = cardWidth * ASPECT;
    this.layout.cardWidth = cardWidth;
    this.layout.cardHeight = cardHeight;

    // --- Centre the 7 columns horizontally ---
    const boardW = cardWidth * 7 + colGap * 6;
    this.layout.marginX = Math.max(4, (w - boardW) / 2);

    // --- Base fan offsets & row gap ---
    let fdOff = cardHeight * FD_RATIO;
    let fuOff = cardHeight * FU_RATIO;
    let rowGap = cardHeight * ROWGAP_RATIO;

    // --- Live tallest column (for vertical fill + overflow protection) ---
    let faceDown = 6, faceUp = 1; // default to the deal-time tallest column
    if (this.game && this.game.tableau) {
      let bestSpan = -1, fD = 0, fU = 0;
      for (const col of this.game.tableau.columns) {
        let cd = 0, cu = 0;
        for (const c of col) { if (c.faceUp) cu++; else cd++; }
        const span = cd * FD_RATIO + Math.max(0, cu - 1) * FU_RATIO;
        if (span > bestSpan) { bestSpan = span; fD = cd; fU = cu; }
      }
      if (fD + fU > 0) { faceDown = fD; faceUp = fU; }
    }

    // Height of the tallest column with the base offsets.
    const columnSpan = () => faceDown * fdOff + Math.max(0, faceUp - 1) * fuOff;
    let blockHeight = cardHeight + rowGap + cardHeight + columnSpan();

    // --- Shrink offsets if the live tallest column would overflow the bottom ---
    if (blockHeight > availH) {
      const fixed = 2 * cardHeight;                 // top-row card + column's first card
      const flexible = rowGap + columnSpan();       // gaps + fanned offsets
      const allowed = availH - fixed;
      if (allowed > 0 && flexible > 0) {
        const s = Math.max(0.18, allowed / flexible);
        rowGap *= s; fdOff *= s; fuOff *= s;
      }
      // Enforce sane minimums so cards still overlap and remain tappable.
      fdOff = Math.max(fdOff, 3);
      fuOff = Math.max(fuOff, 10);
      rowGap = Math.max(rowGap, cardHeight * 0.14);
      blockHeight = cardHeight + rowGap + cardHeight + columnSpan();
    }

    // --- Vertical placement: centre the block in the available space so it
    //     fills the screen; anchor to the top once it no longer fits. ---
    let topRowY;
    if (blockHeight >= availH) {
      topRowY = playTop;
    } else {
      topRowY = playTop + (availH - blockHeight) * 0.5;
    }

    this.layout.stackOffsetY = fuOff;
    this.layout.stackOffsetFaceDown = fdOff;
    this.layout.topRowY = topRowY;
    this.layout.tableauY = topRowY + cardHeight + rowGap;
  }

  _positionCards() {
    const layout = this.layout;
    const pitch = layout.cardWidth + layout.colGap;
    for (let col = 0; col < 7; col++) {
      const x = layout.marginX + col * pitch;
      let y = layout.tableauY;
      for (let row = 0; row < this.game.tableau.columns[col].length; row++) {
        const card = this.game.tableau.columns[col][row];
        card.setPosition(x, y);
        card.width = layout.cardWidth;
        card.height = layout.cardHeight;
        y += card.faceUp ? layout.stackOffsetY : layout.stackOffsetFaceDown;
      }
    }
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    for (const card of this.game.stock.stock) { card.setPosition(stockX, stockY); card.width = layout.cardWidth; card.height = layout.cardHeight; }
    const wasteX = layout.marginX + layout.cardWidth + layout.wasteGap;
    for (const card of this.game.stock.waste) { card.setPosition(wasteX, stockY); card.width = layout.cardWidth; card.height = layout.cardHeight; }
  }

  _getFoundationX(p) { return this.layout.marginX + (3 + p) * (this.layout.cardWidth + this.layout.colGap); }
  _getFoundationY() { return this.layout.topRowY; }
  _getTableauX(col) { return this.layout.marginX + col * (this.layout.cardWidth + this.layout.colGap); }

  _ensureAudio() {
    if (!this.audioInitialized) { this.audio.init(); this.audioInitialized = true; }
    this.audio.setMuted(!this.settings.soundEnabled);
    if (this.audio.setSfxVolume) this.audio.setSfxVolume(this.settings.sfxVolume || 0.8);
    if (this.audio.setMusicVolume) this.audio.setMusicVolume(this.settings.musicVolume || 0.5);
  }

  _onPointerDown(coords) {
    this._ensureAudio();
    this.hud.updatePointer(coords.x, coords.y);
    this.screens.updatePointer(coords.x, coords.y);

    if (this.screens.isActive()) {
      const action = this.screens.handleClick(coords.x, coords.y);
      this._handleScreenAction(action);
      return;
    }
    if (this.screens.showCoach && !this.screens.coachDismissed) {
      this.screens.handleClick(coords.x, coords.y);
      return;
    }
    if (!this.gameActive || this.game.state !== GAME_STATES.PLAYING) return;

    const { x, y } = coords;
    // Record pointer-down for tap-vs-drag discrimination on pointer-up.
    this._pointerDown = { x, y, t: performance.now() };

    if (this.hud.isInHudArea(x, y)) {
      const hudAction = this.hud.handleClick(x, y);
      if (hudAction) { this.audio.play('buttonClick'); this._handleHudAction(hudAction); this._pointerDown = null; return; }
    }

    // A double-tap fired on this same pointerdown (auto-move handled in
    // _onDoubleTap). Skip starting a drag so it isn't disturbed.
    if (this.input.doubleTapped) { this._pointerDown = null; return; }

    const layout = this.layout;
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    if (x >= stockX && x <= stockX + layout.cardWidth && y >= stockY && y <= stockY + layout.cardHeight) {
      this._clearSelection();
      this.game.drawFromStock();
      this._positionCards();
      return;
    }

    const wasteX = layout.marginX + layout.cardWidth + layout.wasteGap;
    const wasteCard = this.game.stock.topWaste();
    if (wasteCard && wasteCard.containsPoint(x, y)) {
      this.game.drag.start([wasteCard], x, y, { type: 'waste', index: 0 });
      return;
    }

    for (let p = 0; p < 4; p++) {
      const fx = this._getFoundationX(p);
      const fy = this._getFoundationY();
      const topCard = this.game.foundation.topCard(p);
      if (topCard && x >= fx && x <= fx + layout.cardWidth && y >= fy && y <= fy + layout.cardHeight) {
        this.game.drag.start([topCard], x, y, { type: 'foundation', index: p });
        return;
      }
    }

    for (let col = 6; col >= 0; col--) {
      const column = this.game.tableau.columns[col];
      for (let i = column.length - 1; i >= 0; i--) {
        const card = column[i];
        if (!card.faceUp) continue;
        const cardBottom = (i < column.length - 1) ? card.y + layout.stackOffsetY : card.y + layout.cardHeight;
        if (x >= card.x && x <= card.x + layout.cardWidth && y >= card.y && y <= cardBottom) {
          if (this.game.tableau.canPickSequence(col, i)) {
            const seq = this.game.tableau.getSequence(col, i);
            this.game.drag.start(seq, x, y, { type: 'tableau', index: col, cardIndex: i });
            return;
          }
        }
      }
    }
  }

  _onPointerMove(coords) {
    this.hud.updatePointer(coords.x, coords.y);
    this.screens.updatePointer(coords.x, coords.y);
    if (this.game.drag.active) {
      this.game.drag.move(coords.x, coords.y, this.layout.cardHeight);
      // Emit dust particles when dragging
      if (!this.settings.reducedMotion) {
        this.particles.emit('cardDragDust', coords.x, coords.y, 1);
      }
    }
  }

  _onPointerUp(coords) {
    // Handle slider end
    const sliderResult = this.screens.handleSliderEnd();
    if (sliderResult) {
      this._handleSliderAction(sliderResult);
      return;
    }

    const { x, y } = coords;
    const down = this._pointerDown;
    this._pointerDown = null;

    // A double-tap already handled the action on pointerdown.
    if (this.input.doubleTapped) {
      if (this.game.drag.active) this.game.drag.end();
      return;
    }

    // Determine whether this gesture was a tap (small movement) vs a drag.
    const movedDist = down ? Math.hypot(x - down.x, y - down.y) : Infinity;
    const isTap = down && movedDist < 12;

    if (this.game.drag.active && isTap) {
      // Treat as a tap: return the picked-up card and route through tap-to-move.
      const source = this.game.drag.source;
      const cards = this.game.drag.cards;
      // Restore the cards to their origin without the error sound.
      this.game.drag.snapBack();
      this._handleTap(x, y, source, cards);
      this._positionCards();
      return;
    }

    if (!this.game.drag.active) {
      // No card under the pointer (e.g. empty column / waste-empty): still allow
      // tap-to-move to complete onto an empty destination, or to deselect.
      if (isTap) { this._handleTap(x, y, null, null); }
      return;
    }

    // --- Real drag-and-drop drop resolution ---
    this._clearSelection();
    const layout = this.layout;
    const cards = this.game.drag.cards;
    const source = this.game.drag.source;
    if (cards.length === 0) { this.game.drag.end(); return; }

    const firstCard = cards[0];
    let moved = false;

    if (cards.length === 1) {
      for (let p = 0; p < 4; p++) {
        const fx = this._getFoundationX(p);
        const fy = this._getFoundationY();
        if (x >= fx && x <= fx + layout.cardWidth && y >= fy && y <= fy + layout.cardHeight) {
          if (this.game.foundation.canPlace(firstCard, p)) {
            this.game.drag.end();
            this._executeDrop(source, cards, { type: 'foundation', index: p });
            moved = true;
            break;
          }
        }
      }
    }

    if (!moved) {
      for (let col = 0; col < 7; col++) {
        const colX = this._getTableauX(col);
        const column = this.game.tableau.columns[col];
        let colBottom = layout.tableauY + layout.cardHeight;
        if (column.length > 0) { const last = column[column.length - 1]; colBottom = last.y + layout.cardHeight; }
        if (x >= colX && x <= colX + layout.cardWidth && y >= layout.tableauY - 10 && y <= colBottom + 30) {
          if (this.game.tableau.canPlace(firstCard, col)) {
            this.game.drag.end();
            this._executeDrop(source, cards, { type: 'tableau', index: col });
            moved = true;
            break;
          }
        }
      }
    }

    if (!moved) {
      this._triggerInvalidFlash(cards);
      this.game.drag.snapBack();
      if (this.audio) this.audio.play('error');
    }
    this._positionCards();
  }

  /** Start a brief red flash on the given cards to signal an invalid move. */
  _triggerInvalidFlash(cards) {
    this._invalidFlash = {
      time: 0,
      duration: 0.45,
      rects: cards.map(c => ({ x: c.x, y: c.y }))
    };
  }

  _handleSliderAction(result) {
    if (!result) return;
    switch (result.action) {
      case 'sfxVolume':
        this.settings.sfxVolume = result.value;
        if (this.audio.setSfxVolume) this.audio.setSfxVolume(result.value);
        break;
      case 'musicVolume':
        this.settings.musicVolume = result.value;
        if (this.audio.setMusicVolume) this.audio.setMusicVolume(result.value);
        break;
    }
    this._saveSettings();
    this.screens.setSettings(this.settings);
  }

  _executeDrop(source, cards, target) {
    this.game.saveUndoState();
    let sourceTopWasFaceDown = false;
    if (source.type === 'tableau') {
      const col = this.game.tableau.columns[source.index];
      const newTopIndex = source.cardIndex - 1;
      if (newTopIndex >= 0 && !col[newTopIndex].faceUp) sourceTopWasFaceDown = true;
    }

    if (source.type === 'waste') this.game.stock.takeFromWaste();
    else if (source.type === 'tableau') this.game.tableau.removeSequence(source.index, source.cardIndex);
    else if (source.type === 'foundation') this.game.foundation.removeTop(source.index);

    if (target.type === 'foundation') {
      this.game.foundation.placeCard(target.index, cards[0]);
      if (source.type === 'waste') this.game.score += SCORING.WASTE_TO_FOUNDATION;
      else if (source.type === 'tableau') this.game.score += SCORING.TABLEAU_TO_FOUNDATION;
      this.audio.play('cardPlace');
      // Sparkle on foundation
      if (!this.settings.reducedMotion) {
        const fx = this._getFoundationX(target.index);
        const fy = this._getFoundationY();
        this.particles.emit('foundationComplete', fx + this.layout.cardWidth / 2, fy + this.layout.cardHeight / 2, 10);
      }
      // Combo/streak feedback for rapid consecutive foundation moves.
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (this._lastFoundationTime && now - this._lastFoundationTime < 2600) {
        this._foundationCombo = (this._foundationCombo || 1) + 1;
      } else {
        this._foundationCombo = 1;
      }
      this._lastFoundationTime = now;
      if (this._foundationCombo >= 3) {
        this._showToast('Combo x' + this._foundationCombo + '!', { icon: '\u26A1', color: '#7affc0', duration: 1.4 });
        if (this.audio) this.audio.play('streakBonus');
      }
      this.game._checkWin();
    } else if (target.type === 'tableau') {
      this.game.tableau.placeSequence(target.index, cards);
      if (source.type === 'waste') this.game.score += SCORING.WASTE_TO_TABLEAU;
      else if (source.type === 'foundation') this.game.score = Math.max(0, this.game.score + SCORING.FOUNDATION_TO_TABLEAU);
      if (source.type === 'tableau' && sourceTopWasFaceDown) this.game.score += SCORING.REVEAL_CARD;
      this.audio.play('cardPlace');
    }
    this.game.moves++;
  }

  _saveGameState() {
    if (!this.game || this.game.state !== GAME_STATES.PLAYING) return;
    const state = {
      tableauCols: this.game.tableau.columns.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      foundationPiles: this.game.foundation.piles.map(pile => pile.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      stockCards: this.game.stock.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      wasteCards: this.game.stock.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      score: this.game.score, moves: this.game.moves, timer: this.game.timer,
      drawCount: this.game.drawCount, hardMode: this.game.hardMode, hardModeTime: this.game.hardModeTime
    };
    this.saveManager.saveGameState(state);
  }

  _restoreGameState() {
    const state = this.saveManager.loadGameState();
    if (!state) return false;
    this.game = new Game({ drawCount: state.drawCount || 1, audio: this.audio, hardMode: state.hardMode || false, hardModeTime: state.hardModeTime || 600 });
    this.game.onWin = (score, moves, time) => { this.showingWinAnim = true; setTimeout(() => { this.screens.show('win', { score, moves, time }); this._recordWin(time, moves); }, 3000); };
    this.game.onLose = () => { this.screens.show('gameOver', { score: this.game.score }); this._recordLoss(); };
    this.game.deal();
    const allCards = [...this.game.allCards];
    const findCard = (suit, rank) => allCards.find(c => c.suit === suit && c.rank === rank);
    this.game.tableau.columns = [[], [], [], [], [], [], []];
    this.game.foundation.piles = [[], [], [], []];
    this.game.stock.stock = [];
    this.game.stock.waste = [];
    for (let c = 0; c < 7; c++) { for (const cd of (state.tableauCols[c] || [])) { const card = findCard(cd.suit, cd.rank); if (card) { card.faceUp = cd.faceUp; this.game.tableau.columns[c].push(card); } } }
    for (let p = 0; p < 4; p++) { for (const cd of (state.foundationPiles[p] || [])) { const card = findCard(cd.suit, cd.rank); if (card) { card.faceUp = cd.faceUp; this.game.foundation.piles[p].push(card); } } }
    for (const cd of (state.stockCards || [])) { const card = findCard(cd.suit, cd.rank); if (card) { card.faceUp = cd.faceUp; this.game.stock.stock.push(card); } }
    for (const cd of (state.wasteCards || [])) { const card = findCard(cd.suit, cd.rank); if (card) { card.faceUp = cd.faceUp; this.game.stock.waste.push(card); } }
    this.game.score = state.score || 0; this.game.moves = state.moves || 0; this.game.timer = state.timer || 0;
    this.game.state = GAME_STATES.PLAYING;
    this.hud = new HUD(this.game, this.renderer);
    this._computeLayout(); this._positionCards();
    this.gameActive = true; this.showingWinAnim = false; this.usedUndoThisGame = false; this.isDailyChallenge = false;
    this.hint.active = false; this._clearSelection(); this._invalidFlash = null; this._toasts = [];
    this.screens.hide();
    this.saveManager.clearGameState(); this.screens.setHasSavedGame(false);
    return true;
  }

  _handleScreenAction(action) {
    if (!action) return;
    switch (action) {
      case 'modeSelect': this.screens.show('modeSelect'); break;
      case 'continue': this._restoreGameState(); break;
      case 'settings': this.screens.show('settings'); break;
      case 'statistics': this.screens.show('statistics'); break;
      case 'achievements': this.screens.show('achievements'); break;
      case 'dailyChallenge': this.screens.show('dailyChallenge'); break;
      case 'howToPlay':
        this._htpReturn = (this.screens.activeScreen === 'pause') ? 'pause' : 'mainMenu';
        this.screens.howToPlayPage = 0;
        this.screens.show('howToPlay');
        break;
      case 'htpNext':
        this.screens.howToPlayPage = Math.min(this.screens.howToPlayPage + 1, this.screens.howToPlayPageCount - 1);
        this.screens._buildButtons();
        if (this.audio) this.audio.play('buttonClick');
        break;
      case 'htpPrev':
        this.screens.howToPlayPage = Math.max(this.screens.howToPlayPage - 1, 0);
        this.screens._buildButtons();
        if (this.audio) this.audio.play('buttonClick');
        break;
      case 'htpClose': this.screens.show(this._htpReturn || 'mainMenu'); break;
      case 'claimDailyReward': this._claimDailyReward(); break;
      case 'startEasy': this._startNewGame(false, { drawCount: 1 }); break;
      case 'startMedium': this._startNewGame(true, { drawCount: 1 }); break;
      case 'startHard': this._startNewGame(false, { drawCount: 3 }); break;
      case 'startExpert': this._startNewGame(true, { drawCount: 3 }); break;
      case 'startDaily': {
        const seed = this.dailyChallenge.getTodaySeed();
        this.dailyChallenge.markPlayed();
        this._startNewGame(false, { seed, isDaily: true });
        break;
      }
      case 'sfxVolume': break; // handled by slider
      case 'musicVolume': break; // handled by slider
      case 'cycleAnimSpeed': {
        const speeds = ['slow', 'normal', 'fast'];
        const idx = speeds.indexOf(this.settings.animationSpeed);
        this.settings.animationSpeed = speeds[(idx + 1) % speeds.length];
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'toggleAutoComplete':
        this.settings.autoComplete = !this.settings.autoComplete;
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      case 'cycleHints': {
        const opts = ['off', 'subtle', 'active'];
        const idx = opts.indexOf(this.settings.hintFrequency);
        this.settings.hintFrequency = opts[(idx + 1) % opts.length];
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'cycleCardSize': {
        const sizes = ['small', 'medium', 'large'];
        const idx = sizes.indexOf(this.settings.cardSize);
        this.settings.cardSize = sizes[(idx + 1) % sizes.length];
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'toggleLeftHand':
        this.settings.leftHand = !this.settings.leftHand;
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      case 'cycleThemeMode': {
        const modes = ['dark', 'light', 'auto'];
        const idx = modes.indexOf(this.settings.themeMode);
        this.settings.themeMode = modes[(idx + 1) % modes.length];
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'cycleTheme': {
        const state = { level: this.progression.getLevel(), achievements: this.achievements.getUnlocked(), dailyStreak: this.dailyChallenge.getStreak() };
        const themeKeys = Object.keys(THEMES).filter(k => isThemeUnlocked(k, state));
        const idx = themeKeys.indexOf(this.settings.cardTheme);
        this.settings.cardTheme = themeKeys[(idx + 1) % themeKeys.length];
        setCardTheme(this.settings.cardTheme);
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'cycleTableFelt': {
        const felts = ['green', 'blue', 'red', 'purple', 'dark', 'midnight'];
        const idx = felts.indexOf(this.settings.tableFelt);
        this.settings.tableFelt = felts[(idx + 1) % felts.length];
        this._feltCanvas = null;
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'cycleCardFace': {
        const styles = ['classic', 'modern', 'minimal'];
        const idx = styles.indexOf(this.settings.cardFaceStyle);
        this.settings.cardFaceStyle = styles[(idx + 1) % styles.length];
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      }
      case 'toggleReducedMotion':
        this.settings.reducedMotion = !this.settings.reducedMotion;
        this._saveSettings(); this.screens.setSettings(this.settings); this.screens.show('settings');
        break;
      case 'back': this.screens.show('mainMenu'); break;
      case 'resume': this.game.state = GAME_STATES.PLAYING; this.screens.hide(); break;
      case 'restart': this._startNewGame(this.game.hardMode); break;
      case 'quit': this.gameActive = false; this.showingWinAnim = false; this.screens.show('mainMenu'); break;
      case 'playAgain': this._startNewGame(this.game.hardMode); break;
      case 'mainMenu': this.gameActive = false; this.showingWinAnim = false; this.screens.show('mainMenu'); break;
      default:
        if (action && action.startsWith('achCat_')) {
          this.screens.achievementCategory = action.replace('achCat_', '');
          this.screens.show('achievements');
        }
        break;
    }
  }

  _handleHudAction(action) {
    switch (action) {
      case 'undo': this.game.undo(); this.usedUndoThisGame = true; this._positionCards(); break;
      case 'redo': if (this.game.redo) this.game.redo(); this._positionCards(); break;
      case 'hint': this._activateHint(); break;
      case 'menu': this.game.state = GAME_STATES.PAUSED; this.screens.show('pause'); break;
      case 'autoComplete': this.game.startAutoComplete(); break;
    }
  }

  // --- Hint Highlight System ---

  /**
   * Activate a hint: compute the next suggested move and highlight it on the
   * board with a pulsing golden glow + sparkle + sound. If no move exists,
   * show a toast and offer the stock pile as the hint.
   */
  _activateHint() {
    if (!this.gameActive || this.game.state !== GAME_STATES.PLAYING) return;
    this._ensureAudio();
    this._clearSelection();
    const hint = this.game.getNextHint ? this.game.getNextHint() : null;

    if (!hint) {
      // No tableau/foundation move available.
      const stockHasCards = !this.game.stock.isEmpty() || !this.game.stock.wasteEmpty();
      this.hint = {
        active: true, time: 0, duration: 1.8,
        data: null, isStock: stockHasCards
      };
      if (stockHasCards) {
        this._showToast('No moves \u2014 try drawing from the deck', { icon: '\u267B' });
      } else {
        this._showToast('No more moves available', { icon: '\u26A0' });
      }
      this.audio.play('hint');
      return;
    }

    this.hint = { active: true, time: 0, duration: 1.8, data: hint, isStock: false };
    this.audio.play('hint');
    if (!this.settings.reducedMotion && hint.cards && hint.cards[0]) {
      const c = hint.cards[0];
      this.particles.emit('foundationComplete',
        c.x + this.layout.cardWidth / 2, c.y + this.layout.cardHeight / 2, 8);
    }
  }

  /** Compute the destination rectangle for a hint's `to` descriptor. */
  _getHintTargetRect(to) {
    const layout = this.layout;
    if (!to) return null;
    if (to.type === 'foundation') {
      return { x: this._getFoundationX(to.index), y: this._getFoundationY(), w: layout.cardWidth, h: layout.cardHeight };
    }
    if (to.type === 'tableau') {
      const col = to.col;
      const colX = this._getTableauX(col);
      const column = this.game.tableau.columns[col];
      let y = layout.tableauY;
      if (column.length > 0) { y = column[column.length - 1].y; }
      return { x: colX, y, w: layout.cardWidth, h: layout.cardHeight };
    }
    return null;
  }

  _renderHintHighlight(ctx) {
    if (!this.hint || !this.hint.active) return;
    const t = this.hint.time / this.hint.duration;
    const fade = t > 0.8 ? (1 - t) / 0.2 : 1; // fade out in last 20%
    const pulse = 0.5 + 0.5 * Math.sin(this.hint.time * 8);
    const layout = this.layout;
    const r = Math.min(layout.cardWidth * 0.08, 6);

    const drawGlowRect = (x, y, w, h, color) => {
      ctx.save();
      ctx.globalAlpha = fade * (0.5 + 0.5 * pulse);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + pulse * 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 + pulse * 1.5;
      this.renderer._roundedRectPath(ctx, x - 2, y - 2, w + 4, h + 4, r);
      ctx.stroke();
      ctx.restore();
    };

    const gold = '#ffd24a';

    if (this.hint.isStock) {
      // Highlight the stock pile.
      drawGlowRect(layout.marginX, layout.topRowY, layout.cardWidth, layout.cardHeight, gold);
      return;
    }

    const hint = this.hint.data;
    if (!hint) return;

    // Source card(s) — use their live positions.
    if (hint.cards) {
      for (const card of hint.cards) {
        drawGlowRect(card.x, card.y, layout.cardWidth, layout.cardHeight, gold);
      }
    }
    // Destination pile.
    const target = this._getHintTargetRect(hint.to);
    if (target) drawGlowRect(target.x, target.y, target.w, target.h, '#7affc0');
  }

  // --- Daily Reward ---

  _todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  _isDailyRewardAvailable() {
    const last = this.saveManager.load('solitaire_daily_reward');
    return !last || last.date !== this._todayStamp();
  }

  _claimDailyReward() {
    if (!this._isDailyRewardAvailable()) {
      this._showToast('Daily reward already claimed today', { icon: '\u2714' });
      return;
    }
    this._ensureAudio();
    const streak = this.dailyChallenge.getStreak ? this.dailyChallenge.getStreak() : 0;
    const reward = 50 + Math.min(streak, 7) * 10; // scales a little with streak
    if (this.progression.addCurrency) this.progression.addCurrency(reward);
    this.saveManager.save('solitaire_daily_reward', { date: this._todayStamp() });
    this._saveAllState();
    this._showToast('Daily reward: +' + reward + ' coins', { icon: '\uD83C\uDF81', color: '#ffd24a', duration: 3 });
    this.audio.play('levelUp');
    if (!this.settings.reducedMotion) {
      this.particles.emit('levelUp', this.renderer.logicalWidth / 2, this.renderer.logicalHeight * 0.25, 14);
    }
    // Refresh the daily screen so the button disables.
    this._syncScreenState();
    if (this.screens.activeScreen === 'dailyChallenge') this.screens._buildButtons();
  }

  // --- Toast / Notification System ---

  _showToast(text, opts = {}) {
    if (!this._toasts) this._toasts = [];
    this._toasts.push({
      text,
      icon: opts.icon || '',
      color: opts.color || '#d4af37',
      time: 0,
      duration: opts.duration || 2.6
    });
    // Cap concurrent toasts.
    if (this._toasts.length > 4) this._toasts.shift();
  }

  _updateToasts(dt) {
    if (!this._toasts || this._toasts.length === 0) return;
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      this._toasts[i].time += dt;
      if (this._toasts[i].time >= this._toasts[i].duration) this._toasts.splice(i, 1);
    }
  }

  _renderToasts(ctx) {
    if (!this._toasts || this._toasts.length === 0) return;
    const w = this.renderer.logicalWidth;
    const fontSize = Math.min(w * 0.035, 15);
    const padX = 16;
    const toastH = fontSize + 22;
    let baseY = this.renderer.logicalHeight * 0.16;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this._toasts.length; i++) {
      const toast = this._toasts[i];
      const t = toast.time / toast.duration;
      let alpha = 1;
      if (t < 0.1) alpha = t / 0.1;
      else if (t > 0.8) alpha = (1 - t) / 0.2;
      const label = (toast.icon ? toast.icon + '  ' : '') + toast.text;
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      const textW = ctx.measureText(label).width;
      const boxW = Math.min(textW + padX * 2, w * 0.9);
      const boxX = (w - boxW) / 2;
      const boxY = baseY + i * (toastH + 8);
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = 'rgba(12,28,18,0.95)';
      this.renderer._roundedRectPath(ctx, boxX, boxY, boxW, toastH, 10);
      ctx.fill();
      ctx.strokeStyle = toast.color;
      ctx.globalAlpha = alpha * 0.6;
      ctx.lineWidth = 1.5;
      this.renderer._roundedRectPath(ctx, boxX, boxY, boxW, toastH, 10);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, w / 2, boxY + toastH / 2);
    }
    ctx.restore();
  }

  /** Drain queued achievement unlock notifications into toasts. */
  _drainAchievementNotifications() {
    if (!this.achievements || !this.achievements.hasNotifications) return;
    while (this.achievements.hasNotifications()) {
      const notif = this.achievements.popNotification();
      if (!notif) break;
      const name = notif.name || notif.title || notif.id || 'Achievement';
      this._showToast('Achievement: ' + name, { icon: '\uD83C\uDFC6', color: '#ffd24a', duration: 3.2 });
      this.audio.play('achievementUnlock');
      if (!this.settings.reducedMotion) {
        this.particles.emit('achievementUnlock', this.renderer.logicalWidth / 2, this.renderer.logicalHeight * 0.2, 24);
      }
    }
  }

  // --- Tap-to-Move ---

  _clearSelection() {
    if (this.selectedCards) {
      for (const c of this.selectedCards) { c.glowing = false; }
    }
    this.selectedSource = null;
    this.selectedCards = null;
  }

  _setSelection(source, cards) {
    this._clearSelection();
    this.selectedSource = source;
    this.selectedCards = cards;
    for (const c of cards) { c.glowing = true; c.glowColor = '#4af0c0'; }
    this.audio.play('buttonClick');
  }

  /** Resolve the drop target (foundation/tableau) at a screen coordinate. */
  _findTargetAt(x, y) {
    const layout = this.layout;
    for (let p = 0; p < 4; p++) {
      const fx = this._getFoundationX(p);
      const fy = this._getFoundationY();
      if (x >= fx && x <= fx + layout.cardWidth && y >= fy && y <= fy + layout.cardHeight) {
        return { type: 'foundation', index: p };
      }
    }
    for (let col = 0; col < 7; col++) {
      const colX = this._getTableauX(col);
      const column = this.game.tableau.columns[col];
      let colBottom = layout.tableauY + layout.cardHeight;
      if (column.length > 0) { colBottom = column[column.length - 1].y + layout.cardHeight; }
      if (x >= colX && x <= colX + layout.cardWidth && y >= layout.tableauY - 10 && y <= colBottom + 30) {
        return { type: 'tableau', index: col };
      }
    }
    return null;
  }

  /**
   * Handle a tap (as opposed to a drag). Implements tap-to-move: tap a movable
   * card to select it, then tap a valid destination to move it there.
   * @param {number} x
   * @param {number} y
   * @param {object|null} tappedSource - drag source descriptor if a card was under the tap
   * @param {import('./game/card.js').Card[]|null} tappedCards
   */
  _handleTap(x, y, tappedSource, tappedCards) {
    if (!this.gameActive || this.game.state !== GAME_STATES.PLAYING || this.screens.isActive()) return;

    // If we already have a selection, see if the tap lands on a valid target.
    if (this.selectedSource && this.selectedCards && this.selectedCards.length) {
      const target = this._findTargetAt(x, y);
      if (target) {
        const first = this.selectedCards[0];
        let valid = false;
        if (target.type === 'foundation' && this.selectedCards.length === 1) {
          valid = this.game.foundation.canPlace(first, target.index);
        } else if (target.type === 'tableau') {
          // Don't allow dropping onto the same column it came from.
          const sameCol = this.selectedSource.type === 'tableau' && this.selectedSource.index === target.index;
          valid = !sameCol && this.game.tableau.canPlace(first, target.index);
        }
        if (valid) {
          const source = this.selectedSource;
          const cards = this.selectedCards;
          this._clearSelection();
          this._executeDrop(source, cards, target);
          this._positionCards();
          this.game._checkWin && this.game._checkWin();
          return;
        }
      }
    }

    // Otherwise (re)select the tapped card if it's movable.
    if (tappedCards && tappedCards.length) {
      // Tapping the same already-selected source deselects it.
      if (this.selectedSource && tappedSource &&
          this.selectedSource.type === tappedSource.type &&
          this.selectedSource.index === tappedSource.index &&
          this.selectedSource.cardIndex === tappedSource.cardIndex) {
        this._clearSelection();
      } else {
        this._setSelection(tappedSource, tappedCards);
      }
    } else {
      this._clearSelection();
    }
  }

  _update(dt) {
    this.screens.update(dt);
    this.particles.update(dt);
    this.animations.update(dt);
    this._updateToasts(dt);
    this._drainAchievementNotifications();

    // Hint highlight timer
    if (this.hint && this.hint.active) {
      this.hint.time += dt;
      if (this.hint.time >= this.hint.duration) this.hint.active = false;
    }
    // Invalid-move flash timer
    if (this._invalidFlash) {
      this._invalidFlash.time += dt;
      if (this._invalidFlash.time >= this._invalidFlash.duration) this._invalidFlash = null;
    }

    if (!this.gameActive) { this.input.endFrame(); return; }

    this.game.update(dt);
    this.hud.update(dt);

    // Update HUD xp
    const prog = this.progression;
    this.hud.setXpProgress(prog.getLevelProgress ? prog.getLevelProgress() : (prog.xp % 100), prog.xpForLevel ? prog.xpForLevel(prog.level + 1) : 100, prog.getLevel ? prog.getLevel() : prog.level);

    if (this.showingWinAnim) {
      this.game.updateWinAnimation(dt, this.renderer.logicalWidth, this.renderer.logicalHeight, this.layout.cardWidth, this.layout.cardHeight);
      // Periodic firework bursts over the celebration.
      if (!this.settings.reducedMotion && Math.random() < dt * 3) {
        const w = this.renderer.logicalWidth;
        const h = this.renderer.logicalHeight;
        this.particles.emit('achievementUnlock', Math.random() * w, Math.random() * h * 0.55, 18);
      }
    }
    if (this.game.autoCompleting) this._positionCards();
    if (this.game.state === GAME_STATES.LOST && !this.screens.isActive()) {
      this.screens.show('gameOver', { score: this.game.score });
      this._recordLoss();
    }

    // Ambient particles
    if (!this.settings.reducedMotion && Math.random() < dt * 0.5) {
      const w = this.renderer.logicalWidth;
      const h = this.renderer.logicalHeight;
      this.particles.emit('ambientBackground', Math.random() * w, h, 1);
    }

    this.input.endFrame();
  }

  _render(dt) {
    this._computeLayout();
    this.renderer.clear('#0d2818');
    const ctx = this.renderer.ctx;
    const layout = this.layout;

    // Felt background
    this._drawFelt(ctx);

    // Ambient particles (behind cards)
    this.particles.render(ctx);

    if (!this.gameActive) {
      this.screens.render();
      this._renderToasts(ctx);
      return;
    }

    if (this.showingWinAnim) {
      this._renderWinAnimation(ctx);
      this.hud.render();
      if (this.screens.isActive()) this.screens.render();
      this._renderToasts(ctx);
      return;
    }

    // Foundation placeholders
    for (let p = 0; p < 4; p++) {
      const fx = this._getFoundationX(p);
      const fy = this._getFoundationY();
      this.renderer.drawRoundedRect(fx, fy, layout.cardWidth, layout.cardHeight, 4, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.12)', 1.5);
      const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
      ctx.font = (layout.cardWidth * 0.4) + 'px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const suitChars = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
      ctx.fillText(suitChars[suits[p]], fx + layout.cardWidth / 2, fy + layout.cardHeight / 2);
    }

    // Foundation cards
    for (let p = 0; p < 4; p++) {
      const pile = this.game.foundation.piles[p];
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        topCard.x = this._getFoundationX(p);
        topCard.y = this._getFoundationY();
        topCard.render(ctx, layout.cardWidth, layout.cardHeight);
      }
    }

    // Stock pile
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    if (this.game.stock.stock.length > 0) {
      this.renderer.drawRoundedRect(stockX, stockY, layout.cardWidth, layout.cardHeight, 4, '#1a3a6b', '#0d2040', 1);
      ctx.font = 'bold ' + (layout.cardWidth * 0.2) + 'px system-ui';
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(this.game.stock.stock.length), stockX + layout.cardWidth / 2, stockY + layout.cardHeight / 2);
    } else {
      this.renderer.drawRoundedRect(stockX, stockY, layout.cardWidth, layout.cardHeight, 4, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.1)', 1.5);
      ctx.font = (layout.cardWidth * 0.4) + 'px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↻', stockX + layout.cardWidth / 2, stockY + layout.cardHeight / 2);
    }

    // Waste pile
    const wasteX = layout.marginX + layout.cardWidth + layout.wasteGap;
    const visibleWaste = this.game.stock.visibleWaste();
    if (visibleWaste.length === 0) {
      this.renderer.drawRoundedRect(wasteX, stockY, layout.cardWidth, layout.cardHeight, 4, 'rgba(255,255,255,0.01)', 'rgba(255,255,255,0.06)', 1);
    }
    for (let i = 0; i < visibleWaste.length; i++) {
      const card = visibleWaste[i];
      const offset = this.game.stock.drawCount === 3 ? i * (layout.cardWidth * 0.2) : 0;
      if (!card.dragging) { card.x = wasteX + offset; card.y = stockY; }
      card.render(ctx, layout.cardWidth, layout.cardHeight);
    }

    // Tableau columns
    for (let col = 0; col < 7; col++) {
      const colX = this._getTableauX(col);
      const column = this.game.tableau.columns[col];
      if (column.length === 0) {
        this.renderer.drawRoundedRect(colX, layout.tableauY, layout.cardWidth, layout.cardHeight, 4, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)', 1);
      }
      let y = layout.tableauY;
      for (let i = 0; i < column.length; i++) {
        const card = column[i];
        if (!card.dragging) { card.x = colX; card.y = y; }
        card.render(ctx, layout.cardWidth, layout.cardHeight);
        y += card.faceUp ? layout.stackOffsetY : layout.stackOffsetFaceDown;
      }
    }

    // Drop-zone highlights while dragging
    if (this.game.drag.active && this.game.drag.cards.length > 0) {
      this._renderDropZones(ctx);
    }

    // Hint highlight (pulsing glow on suggested move)
    this._renderHintHighlight(ctx);

    // Invalid-move red flash
    this._renderInvalidFlash(ctx);

    // Dragged cards
    if (this.game.drag.active) {
      for (const card of this.game.drag.cards) card.render(ctx, layout.cardWidth, layout.cardHeight);
    }

    // HUD
    this.hud.render();

    // Screen overlay
    if (this.screens.isActive()) this.screens.render();

    // Toasts (always on top)
    this._renderToasts(ctx);
  }

  _renderDropZones(ctx) {
    const layout = this.layout;
    const first = this.game.drag.cards[0];
    const source = this.game.drag.source;
    const r = Math.min(layout.cardWidth * 0.08, 6);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
    const drawZone = (x, y, color) => {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * pulse;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + pulse * 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      this.renderer._roundedRectPath(ctx, x - 1, y - 1, layout.cardWidth + 2, layout.cardHeight + 2, r);
      ctx.stroke();
      ctx.restore();
    };
    // Valid foundations (single card only)
    if (this.game.drag.cards.length === 1) {
      for (let p = 0; p < 4; p++) {
        if (source && source.type === 'foundation' && source.index === p) continue;
        if (this.game.foundation.canPlace(first, p)) {
          drawZone(this._getFoundationX(p), this._getFoundationY(), '#7affc0');
        }
      }
    }
    // Valid tableau columns
    for (let col = 0; col < 7; col++) {
      if (source && source.type === 'tableau' && source.index === col) continue;
      if (this.game.tableau.canPlace(first, col)) {
        const column = this.game.tableau.columns[col];
        const y = column.length > 0 ? column[column.length - 1].y : layout.tableauY;
        drawZone(this._getTableauX(col), y, '#7affc0');
      }
    }
  }

  _renderInvalidFlash(ctx) {
    if (!this._invalidFlash) return;
    const layout = this.layout;
    const t = this._invalidFlash.time / this._invalidFlash.duration;
    const alpha = (1 - t) * (0.5 + 0.5 * Math.sin(t * 30));
    const r = Math.min(layout.cardWidth * 0.08, 6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha) * 0.8;
    ctx.strokeStyle = '#ff4444';
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    for (const rect of this._invalidFlash.rects) {
      this.renderer._roundedRectPath(ctx, rect.x - 1, rect.y - 1, layout.cardWidth + 2, layout.cardHeight + 2, r);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderWinAnimation(ctx) {
    const layout = this.layout;
    for (const data of this.game.winAnimationCards) {
      if (!data.launched) continue;
      data.card.x = data.x; data.card.y = data.y; data.card.faceUp = true;
      data.card.render(ctx, layout.cardWidth, layout.cardHeight);
    }
  }

  _drawFelt(ctx) {
    if (!this._feltCanvas) this._regenerateFeltCanvas();
    ctx.drawImage(this._feltCanvas, 0, 0);
  }

  _regenerateFeltCanvas() {
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    this._feltCanvas = document.createElement('canvas');
    this._feltCanvas.width = w; this._feltCanvas.height = h;
    const offCtx = this._feltCanvas.getContext('2d');

    // Premium felt: two-tone palette per theme, radial light pool + vignette.
    const feltPalettes = {
      green:    ['#155a34', '#0d2818', '#061410'],
      blue:     ['#173a63', '#0d1828', '#060e1a'],
      red:      ['#5a1626', '#281018', '#160810'],
      purple:   ['#341a52', '#1a0d28', '#0e0618'],
      dark:     ['#1c1c28', '#0a0a0a', '#000000'],
      midnight: ['#0d1630', '#050a14', '#01030a']
    };
    const pal = feltPalettes[this.settings.tableFelt] || feltPalettes.green;

    // Base fill
    offCtx.fillStyle = pal[1];
    offCtx.fillRect(0, 0, w, h);

    // Radial light pool from upper-centre (table spotlight)
    const rg = offCtx.createRadialGradient(w * 0.5, h * 0.32, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    rg.addColorStop(0, pal[0]);
    rg.addColorStop(0.55, pal[1]);
    rg.addColorStop(1, pal[2]);
    offCtx.fillStyle = rg;
    offCtx.fillRect(0, 0, w, h);

    // Subtle woven texture
    offCtx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let gy = 0; gy < h; gy += 4) {
      for (let gx = 0; gx < w; gx += 4) {
        if ((gx + gy) % 8 === 0) offCtx.fillRect(gx, gy, 1, 1);
      }
    }
    offCtx.fillStyle = 'rgba(0,0,0,0.025)';
    for (let gy = 2; gy < h; gy += 4) {
      for (let gx = 2; gx < w; gx += 4) {
        if ((gx + gy) % 8 === 0) offCtx.fillRect(gx, gy, 1, 1);
      }
    }

    // Vignette around the edges for depth
    const vg = offCtx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    offCtx.fillStyle = vg;
    offCtx.fillRect(0, 0, w, h);
  }
}

// Boot
try {
  const errorEl = document.getElementById('fatal-error');
  if (errorEl) errorEl.hidden = true;
  const app = new App();
  window.__app = app;
} catch (e) {
  console.error('Fatal error:', e);
  const errorEl = document.getElementById('fatal-error');
  const msgEl = document.getElementById('error-message');
  if (errorEl && msgEl) {
    errorEl.removeAttribute('hidden');
    msgEl.textContent = e.message || 'An unexpected error occurred.';
  }
}
