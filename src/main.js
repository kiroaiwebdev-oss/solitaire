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
      marginX: 10, marginY: 10,
      stackOffsetY: 20, stackOffsetFaceDown: 5,
      topRowY: 55, tableauY: 180, padding: 10
    };

    this.audioInitialized = false;
    this.gameActive = false;
    this.showingWinAnim = false;
    this.usedUndoThisGame = false;
    this.isDailyChallenge = false;
    this.deferredInstallPrompt = null;

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
        totalCompleted: this.dailyChallenge.totalCompleted || 0
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
      case 'hint': if (this.game.getNextHint) this.game.getNextHint(); break;
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

    const coachSeen = this.saveManager.load(SAVE_KEY_COACH);
    if (!coachSeen) { this.screens.showCoachMarks(); this.saveManager.save(SAVE_KEY_COACH, true); }
  }

  _computeLayout() {
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    const maxCardWidth = (w - 80) / 7.5;
    this.layout.cardWidth = Math.min(maxCardWidth, 75);
    this.layout.cardHeight = this.layout.cardWidth * (100 / 70);
    this.layout.marginX = (w - (this.layout.cardWidth * 7 + 10 * 6)) / 2;
    if (this.layout.marginX < 5) this.layout.marginX = 5;
    this.layout.topRowY = 55;
    this.layout.tableauY = this.layout.topRowY + this.layout.cardHeight + 20;
    this.layout.stackOffsetY = Math.max(this.layout.cardHeight * 0.2, 15);
    this.layout.stackOffsetFaceDown = Math.max(this.layout.cardHeight * 0.06, 4);

    // Dynamic stack offset to prevent overflow
    if (this.game && this.game.tableau) {
      let maxLen = 0;
      for (const col of this.game.tableau.columns) maxLen = Math.max(maxLen, col.length);
      const available = h - this.layout.tableauY - 20;
      const needed = maxLen * this.layout.stackOffsetY;
      if (needed > available && maxLen > 3) {
        this.layout.stackOffsetY = Math.max(available / maxLen, 10);
      }
    }
  }

  _positionCards() {
    const layout = this.layout;
    for (let col = 0; col < 7; col++) {
      const x = layout.marginX + col * (layout.cardWidth + 10);
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
    const wasteX = layout.marginX + layout.cardWidth + 15;
    for (const card of this.game.stock.waste) { card.setPosition(wasteX, stockY); card.width = layout.cardWidth; card.height = layout.cardHeight; }
  }

  _getFoundationX(p) { return this.layout.marginX + (3 + p) * (this.layout.cardWidth + 10); }
  _getFoundationY() { return this.layout.topRowY; }
  _getTableauX(col) { return this.layout.marginX + col * (this.layout.cardWidth + 10); }

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
    if (this.hud.isInHudArea(x, y)) {
      const hudAction = this.hud.handleClick(x, y);
      if (hudAction) { this.audio.play('buttonClick'); this._handleHudAction(hudAction); return; }
    }

    const layout = this.layout;
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    if (x >= stockX && x <= stockX + layout.cardWidth && y >= stockY && y <= stockY + layout.cardHeight) {
      this.game.drawFromStock();
      this._positionCards();
      return;
    }

    const wasteX = layout.marginX + layout.cardWidth + 15;
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

    if (!this.game.drag.active) return;
    const { x, y } = coords;
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
      this.game.drag.snapBack();
      if (this.audio) this.audio.play('error');
    }
    this._positionCards();
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
      case 'hint': if (this.game.getNextHint) this.game.getNextHint(); break;
      case 'menu': this.game.state = GAME_STATES.PAUSED; this.screens.show('pause'); break;
      case 'autoComplete': this.game.startAutoComplete(); break;
    }
  }

  _update(dt) {
    this.screens.update(dt);
    this.particles.update(dt);
    this.animations.update(dt);

    if (!this.gameActive) { this.input.endFrame(); return; }

    this.game.update(dt);
    this.hud.update(dt);

    // Update HUD xp
    const prog = this.progression;
    this.hud.setXpProgress(prog.getLevelProgress ? prog.getLevelProgress() : (prog.xp % 100), prog.xpForLevel ? prog.xpForLevel(prog.level + 1) : 100, prog.getLevel ? prog.getLevel() : prog.level);

    if (this.showingWinAnim) {
      this.game.updateWinAnimation(dt, this.renderer.logicalWidth, this.renderer.logicalHeight, this.layout.cardWidth, this.layout.cardHeight);
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
      return;
    }

    if (this.showingWinAnim) {
      this._renderWinAnimation(ctx);
      this.hud.render();
      if (this.screens.isActive()) this.screens.render();
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
    const wasteX = layout.marginX + layout.cardWidth + 15;
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

    // Dragged cards
    if (this.game.drag.active) {
      for (const card of this.game.drag.cards) card.render(ctx, layout.cardWidth, layout.cardHeight);
    }

    // HUD
    this.hud.render();

    // Screen overlay
    if (this.screens.isActive()) this.screens.render();
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

    // Felt color based on settings
    const feltColors = { green: '#0d2818', blue: '#0d1828', red: '#281018', purple: '#1a0d28', dark: '#0a0a0a', midnight: '#050a14' };
    offCtx.fillStyle = feltColors[this.settings.tableFelt] || feltColors.green;
    offCtx.fillRect(0, 0, w, h);

    // Subtle texture
    offCtx.fillStyle = 'rgba(0,0,0,0.015)';
    for (let gy = 0; gy < h; gy += 4) {
      for (let gx = 0; gx < w; gx += 4) {
        if ((gx + gy) % 8 === 0) offCtx.fillRect(gx, gy, 1, 1);
      }
    }
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
