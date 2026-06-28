/**
 * Main boot module: imports all modules, picks platform adapter,
 * creates game, starts loop, provides fatal-error UI.
 */

import { GameLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { Renderer } from './core/render.js';
import { Audio } from './core/audio.js';
import { Game, GAME_STATES } from './game/game.js';
import { DragSystem } from './game/drag.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { getAdapter } from './platform/index.js';
import { SaveManager } from './systems/save-manager.js';
import { SCORING } from './config/scoring.js';
import { THEMES, DEFAULT_THEME } from './config/themes.js';

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

    // Load settings
    this.settings = this._loadSettings();

    this.game = new Game({
      drawCount: this.settings.drawMode,
      audio: this.audio
    });

    this.hud = new HUD(this.game, this.renderer);
    this.screens = new Screens(this.renderer, this.audio);
    this.screens.setSettings(this.settings);

    this.layout = {
      cardWidth: 70,
      cardHeight: 100,
      marginX: 10,
      marginY: 10,
      stackOffsetY: 20,
      stackOffsetFaceDown: 5,
      topRowY: 55,
      tableauY: 180,
      padding: 10
    };

    this.audioInitialized = false;
    this.gameActive = false;
    this.showingWinAnim = false;

    // Stats
    this.stats = this._loadStats();
    this.screens.setStats(this.stats);

    // Game callbacks
    this.game.onWin = (score, moves, time) => {
      this.showingWinAnim = true;
      // Delay showing the win screen so animation plays first
      setTimeout(() => {
        this.screens.show('win', { score, moves, time });
        this._recordWin(time);
      }, 3000);
    };

    this.game.onLose = () => {
      this.screens.show('gameOver', { score: this.game.score });
      this._recordLoss();
    };

    this._initApp();
  }

  _loadSettings() {
    const saved = this.saveManager.load(SAVE_KEY_SETTINGS);
    return {
      soundEnabled: saved ? saved.soundEnabled !== false : true,
      cardTheme: saved ? (saved.cardTheme || DEFAULT_THEME) : DEFAULT_THEME,
      drawMode: saved ? (saved.drawMode || 1) : 1
    };
  }

  _saveSettings() {
    this.saveManager.save(SAVE_KEY_SETTINGS, this.settings);
  }

  _loadStats() {
    const saved = this.saveManager.load(SAVE_KEY_STATS);
    return saved || { played: 0, won: 0, bestTime: null, currentStreak: 0, longestStreak: 0 };
  }

  _saveStats() {
    this.saveManager.save(SAVE_KEY_STATS, this.stats);
  }

  _recordWin(time) {
    this.stats.played++;
    this.stats.won++;
    this.stats.currentStreak++;
    if (this.stats.currentStreak > this.stats.longestStreak) {
      this.stats.longestStreak = this.stats.currentStreak;
    }
    if (this.stats.bestTime === null || time < this.stats.bestTime) {
      this.stats.bestTime = time;
    }
    this._saveStats();
    this.screens.setStats(this.stats);
  }

  _recordLoss() {
    this.stats.played++;
    this.stats.currentStreak = 0;
    this._saveStats();
    this.screens.setStats(this.stats);
  }

  _initApp() {
    // Show main menu on start
    this.screens.show('mainMenu');

    this.input.on('pointerdown', (coords) => this._onPointerDown(coords));
    this.input.on('pointermove', (coords) => this._onPointerMove(coords));
    this.input.on('pointerup', (coords) => this._onPointerUp(coords));

    this.loop.start(
      (dt) => this._update(dt),
      (dt) => this._render(dt)
    );
  }

  _startNewGame(hardMode) {
    this.game = new Game({
      drawCount: hardMode ? 3 : this.settings.drawMode,
      audio: this.audio,
      hardMode,
      hardModeTime: SCORING.HARD_MODE_TIME
    });
    this.game.onWin = (score, moves, time) => {
      this.showingWinAnim = true;
      setTimeout(() => {
        this.screens.show('win', { score, moves, time });
        this._recordWin(time);
      }, 3000);
    };
    this.game.onLose = () => {
      this.screens.show('gameOver', { score: this.game.score });
      this._recordLoss();
    };
    this.game.deal();
    this.hud = new HUD(this.game, this.renderer);
    this.hud.lastScore = 0;
    this._computeLayout();
    this._positionCards();
    this.gameActive = true;
    this.showingWinAnim = false;
    this.screens.hide();

    // Coach marks on first run
    const coachSeen = this.saveManager.load(SAVE_KEY_COACH);
    if (!coachSeen) {
      this.screens.showCoachMarks();
      this.saveManager.save(SAVE_KEY_COACH, true);
    }
  }

  _computeLayout() {
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;

    // Compute card size to fit 7 columns with gaps
    const maxCardWidth = (w - 80) / 7.5;
    this.layout.cardWidth = Math.min(maxCardWidth, 75);
    this.layout.cardHeight = this.layout.cardWidth * (100 / 70);

    this.layout.marginX = (w - (this.layout.cardWidth * 7 + 10 * 6)) / 2;
    if (this.layout.marginX < 5) this.layout.marginX = 5;

    // Push top row down to accommodate HUD bar
    this.layout.topRowY = 55;
    this.layout.tableauY = this.layout.topRowY + this.layout.cardHeight + 20;
    this.layout.stackOffsetY = Math.max(this.layout.cardHeight * 0.2, 15);
    this.layout.stackOffsetFaceDown = Math.max(this.layout.cardHeight * 0.06, 4);
  }

  _positionCards() {
    const layout = this.layout;

    // Position tableau cards
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

    // Position stock
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    for (const card of this.game.stock.stock) {
      card.setPosition(stockX, stockY);
      card.width = layout.cardWidth;
      card.height = layout.cardHeight;
    }

    // Position waste
    const wasteX = layout.marginX + layout.cardWidth + 15;
    for (const card of this.game.stock.waste) {
      card.setPosition(wasteX, stockY);
      card.width = layout.cardWidth;
      card.height = layout.cardHeight;
    }
  }

  _getFoundationX(pileIndex) {
    return this.layout.marginX + (3 + pileIndex) * (this.layout.cardWidth + 10);
  }

  _getFoundationY() {
    return this.layout.topRowY;
  }

  _getTableauX(colIndex) {
    return this.layout.marginX + colIndex * (this.layout.cardWidth + 10);
  }

  _ensureAudio() {
    if (!this.audioInitialized) {
      this.audio.init();
      this.audioInitialized = true;
    }
    this.audio.setMuted(!this.settings.soundEnabled);
  }

  _onPointerDown(coords) {
    this._ensureAudio();

    // Update hover states
    this.hud.updatePointer(coords.x, coords.y);
    this.screens.updatePointer(coords.x, coords.y);

    // Screen overlay takes priority
    if (this.screens.isActive()) {
      const action = this.screens.handleClick(coords.x, coords.y);
      this._handleScreenAction(action);
      return;
    }

    // Coach marks
    if (this.screens.showCoach && !this.screens.coachDismissed) {
      this.screens.handleClick(coords.x, coords.y);
      return;
    }

    if (!this.gameActive || this.game.state !== GAME_STATES.PLAYING) return;

    const { x, y } = coords;

    // Check HUD first
    if (this.hud.isInHudArea(x, y)) {
      const hudAction = this.hud.handleClick(x, y);
      if (hudAction) {
        this.audio.play('buttonClick');
        this._handleHudAction(hudAction);
        return;
      }
    }

    const layout = this.layout;

    // Check stock click
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    if (x >= stockX && x <= stockX + layout.cardWidth &&
        y >= stockY && y <= stockY + layout.cardHeight) {
      this.game.drawFromStock();
      this._positionCards();
      return;
    }

    // Check waste pile - try to pick up top waste card
    const wasteX = layout.marginX + layout.cardWidth + 15;
    const wasteCard = this.game.stock.topWaste();
    if (wasteCard && wasteCard.containsPoint(x, y)) {
      this.game.drag.start([wasteCard], x, y, { type: 'waste', index: 0 });
      return;
    }

    // Check foundation piles (for dragging back to tableau)
    for (let p = 0; p < 4; p++) {
      const fx = this._getFoundationX(p);
      const fy = this._getFoundationY();
      const topCard = this.game.foundation.topCard(p);
      if (topCard && x >= fx && x <= fx + layout.cardWidth &&
          y >= fy && y <= fy + layout.cardHeight) {
        this.game.drag.start([topCard], x, y, { type: 'foundation', index: p });
        return;
      }
    }

    // Check tableau columns (pick up card or sequence)
    for (let col = 6; col >= 0; col--) {
      const column = this.game.tableau.columns[col];
      for (let i = column.length - 1; i >= 0; i--) {
        const card = column[i];
        if (!card.faceUp) continue;

        const cardBottom = (i < column.length - 1) ?
          card.y + (card.faceUp ? layout.stackOffsetY : layout.stackOffsetFaceDown) :
          card.y + layout.cardHeight;

        if (x >= card.x && x <= card.x + layout.cardWidth &&
            y >= card.y && y <= cardBottom) {
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
    }
  }

  _onPointerUp(coords) {
    if (!this.game.drag.active) return;

    const { x, y } = coords;
    const layout = this.layout;
    const dragData = this.game.drag.end();
    const cards = dragData.cards;
    const source = dragData.source;

    if (cards.length === 0) return;

    const firstCard = cards[0];
    let moved = false;

    // Try to drop on foundation (single card only)
    if (cards.length === 1) {
      for (let p = 0; p < 4; p++) {
        const fx = this._getFoundationX(p);
        const fy = this._getFoundationY();
        if (x >= fx && x <= fx + layout.cardWidth &&
            y >= fy && y <= fy + layout.cardHeight) {
          if (this.game.foundation.canPlace(firstCard, p)) {
            this._executeDrop(source, cards, { type: 'foundation', index: p });
            moved = true;
            break;
          }
        }
      }
    }

    // Try to drop on tableau column
    if (!moved) {
      for (let col = 0; col < 7; col++) {
        const colX = this._getTableauX(col);
        const column = this.game.tableau.columns[col];
        let colBottom = layout.tableauY + layout.cardHeight;
        if (column.length > 0) {
          const lastCard = column[column.length - 1];
          colBottom = lastCard.y + layout.cardHeight;
        }
        if (x >= colX && x <= colX + layout.cardWidth &&
            y >= layout.tableauY - 10 && y <= colBottom + 30) {
          if (this.game.tableau.canPlace(firstCard, col)) {
            this._executeDrop(source, cards, { type: 'tableau', index: col });
            moved = true;
            break;
          }
        }
      }
    }

    // If not moved, snap back
    if (!moved) {
      this._returnCards(source, cards);
      if (this.audio) this.audio.play('error');
    }

    this._positionCards();

    // Check for auto-complete
    if (this.game.canAutoComplete() && !this.game.autoCompleting) {
      // Show the button, don't auto-start
    }
  }

  _executeDrop(source, cards, target) {
    this.game.saveUndoState();

    // Remove from source
    if (source.type === 'waste') {
      this.game.stock.takeFromWaste();
    } else if (source.type === 'tableau') {
      this.game.tableau.removeSequence(source.index, source.cardIndex);
    } else if (source.type === 'foundation') {
      this.game.foundation.removeTop(source.index);
    }

    // Place at target
    if (target.type === 'foundation') {
      this.game.foundation.placeCard(target.index, cards[0]);
      if (source.type === 'waste') {
        this.game.score += SCORING.WASTE_TO_FOUNDATION;
      } else if (source.type === 'tableau') {
        this.game.score += SCORING.TABLEAU_TO_FOUNDATION;
      }
      this.audio.play('cardPlace');
      this.game._checkWin();
    } else if (target.type === 'tableau') {
      this.game.tableau.placeSequence(target.index, cards);
      if (source.type === 'waste') {
        this.game.score += SCORING.WASTE_TO_TABLEAU;
      } else if (source.type === 'foundation') {
        this.game.score = Math.max(0, this.game.score + SCORING.FOUNDATION_TO_TABLEAU);
      }
      // Check if we revealed a card
      if (source.type === 'tableau') {
        const col = this.game.tableau.columns[source.index];
        if (col.length > 0 && col[col.length - 1].faceUp) {
          this.game.score += SCORING.REVEAL_CARD;
        }
      }
      this.audio.play('cardPlace');
    }

    this.game.moves++;
  }

  _returnCards(source, cards) {
    for (const card of cards) {
      card.dragging = false;
    }
  }

  _handleScreenAction(action) {
    if (!action) return;
    switch (action) {
      case 'modeSelect':
        this.screens.show('modeSelect');
        break;
      case 'continue':
        this.screens.hide();
        break;
      case 'settings':
        this.screens.show('settings');
        break;
      case 'statistics':
        this.screens.show('statistics');
        break;
      case 'startEasy':
        this._startNewGame(false);
        break;
      case 'startHard':
        this._startNewGame(true);
        break;
      case 'toggleSound':
        this.settings.soundEnabled = !this.settings.soundEnabled;
        this.audio.setMuted(!this.settings.soundEnabled);
        this._saveSettings();
        this.screens.setSettings(this.settings);
        this.screens.show('settings'); // refresh buttons
        break;
      case 'cycleTheme': {
        const themeKeys = Object.keys(THEMES);
        const idx = themeKeys.indexOf(this.settings.cardTheme);
        this.settings.cardTheme = themeKeys[(idx + 1) % themeKeys.length];
        this._saveSettings();
        this.screens.setSettings(this.settings);
        this.screens.show('settings');
        break;
      }
      case 'cycleDrawMode':
        this.settings.drawMode = this.settings.drawMode === 1 ? 3 : 1;
        this._saveSettings();
        this.screens.setSettings(this.settings);
        this.screens.show('settings');
        break;
      case 'back':
        this.screens.show('mainMenu');
        break;
      case 'resume':
        this.game.state = GAME_STATES.PLAYING;
        this.screens.hide();
        break;
      case 'restart':
        this._startNewGame(this.game.hardMode);
        break;
      case 'quit':
        this.gameActive = false;
        this.showingWinAnim = false;
        this.screens.show('mainMenu');
        break;
      case 'playAgain':
        this._startNewGame(this.game.hardMode);
        break;
      case 'mainMenu':
        this.screens.show('mainMenu');
        break;
    }
  }

  _handleHudAction(action) {
    switch (action) {
      case 'undo':
        this.game.undo();
        this._positionCards();
        break;
      case 'menu':
        this.game.state = GAME_STATES.PAUSED;
        this.screens.show('pause');
        break;
      case 'newGame':
        this.screens.show('modeSelect');
        break;
      case 'autoComplete':
        this.game.startAutoComplete();
        break;
    }
  }

  _update(dt) {
    this.screens.update(dt);

    if (!this.gameActive) {
      this.input.endFrame();
      return;
    }

    this.game.update(dt);
    this.hud.update(dt);

    // Win animation physics
    if (this.showingWinAnim) {
      this.game.updateWinAnimation(dt,
        this.renderer.logicalWidth, this.renderer.logicalHeight,
        this.layout.cardWidth, this.layout.cardHeight);
    }

    if (this.game.autoCompleting) {
      this._positionCards();
    }

    // Detect game over from hard mode (timer)
    if (this.game.state === GAME_STATES.LOST && !this.screens.isActive()) {
      this.screens.show('gameOver', { score: this.game.score });
      this._recordLoss();
    }

    this.input.endFrame();
  }

  _render(dt) {
    this._computeLayout();
    this.renderer.clear('#1a6b3c');

    const ctx = this.renderer.ctx;
    const layout = this.layout;

    // Draw felt texture (subtle)
    this._drawFelt(ctx);

    if (!this.gameActive) {
      // Screens overlay (main menu)
      this.screens.render();
      return;
    }

    // Win animation rendering
    if (this.showingWinAnim) {
      this._renderWinAnimation(ctx);
      this.hud.render();
      if (this.screens.isActive()) this.screens.render();
      return;
    }

    // Draw foundation placeholders
    for (let p = 0; p < 4; p++) {
      const fx = this._getFoundationX(p);
      const fy = this._getFoundationY();
      this.renderer.drawRoundedRect(fx, fy, layout.cardWidth, layout.cardHeight,
        4, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.2)', 1.5);

      const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
      ctx.font = `${layout.cardWidth * 0.4}px system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const suitChars = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
      ctx.fillText(suitChars[suits[p]], fx + layout.cardWidth / 2, fy + layout.cardHeight / 2);
    }

    // Draw foundation cards
    for (let p = 0; p < 4; p++) {
      const pile = this.game.foundation.piles[p];
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const fx = this._getFoundationX(p);
        const fy = this._getFoundationY();
        topCard.x = fx;
        topCard.y = fy;
        topCard.render(ctx, layout.cardWidth, layout.cardHeight);
      }
    }

    // Draw stock pile
    const stockX = layout.marginX;
    const stockY = layout.topRowY;
    if (this.game.stock.stock.length > 0) {
      this.renderer.drawRoundedRect(stockX, stockY, layout.cardWidth, layout.cardHeight,
        4, '#1a3a6b', '#0d2040', 1);
      ctx.font = `bold ${layout.cardWidth * 0.2}px system-ui`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.game.stock.stock.length),
        stockX + layout.cardWidth / 2, stockY + layout.cardHeight / 2);
    } else {
      this.renderer.drawRoundedRect(stockX, stockY, layout.cardWidth, layout.cardHeight,
        4, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.15)', 1.5);
      ctx.font = `${layout.cardWidth * 0.4}px system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u21BB', stockX + layout.cardWidth / 2, stockY + layout.cardHeight / 2);
    }

    // Draw waste pile
    const wasteX = layout.marginX + layout.cardWidth + 15;
    const visibleWaste = this.game.stock.visibleWaste();
    if (visibleWaste.length === 0) {
      this.renderer.drawRoundedRect(wasteX, stockY, layout.cardWidth, layout.cardHeight,
        4, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.08)', 1);
    }
    for (let i = 0; i < visibleWaste.length; i++) {
      const card = visibleWaste[i];
      const offset = this.game.stock.drawCount === 3 ? i * (layout.cardWidth * 0.2) : 0;
      if (!card.dragging) {
        card.x = wasteX + offset;
        card.y = stockY;
      }
      card.render(ctx, layout.cardWidth, layout.cardHeight);
    }

    // Draw tableau columns
    for (let col = 0; col < 7; col++) {
      const colX = this._getTableauX(col);
      const column = this.game.tableau.columns[col];

      if (column.length === 0) {
        this.renderer.drawRoundedRect(colX, layout.tableauY, layout.cardWidth, layout.cardHeight,
          4, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.1)', 1);
      }

      let y = layout.tableauY;
      for (let i = 0; i < column.length; i++) {
        const card = column[i];
        if (!card.dragging) {
          card.x = colX;
          card.y = y;
        }
        card.render(ctx, layout.cardWidth, layout.cardHeight);
        y += card.faceUp ? layout.stackOffsetY : layout.stackOffsetFaceDown;
      }
    }

    // Draw dragged cards on top
    if (this.game.drag.active) {
      for (const card of this.game.drag.cards) {
        card.render(ctx, layout.cardWidth, layout.cardHeight);
      }
    }

    // HUD
    this.hud.render();

    // Screens overlay
    if (this.screens.isActive()) {
      this.screens.render();
    }
  }

  _renderWinAnimation(ctx) {
    const layout = this.layout;
    for (const data of this.game.winAnimationCards) {
      if (!data.launched) continue;
      data.card.x = data.x;
      data.card.y = data.y;
      data.card.faceUp = true;
      data.card.render(ctx, layout.cardWidth, layout.cardHeight);

      // Simple particle trail
      if (data.bounces < 3) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(data.x + layout.cardWidth / 2, data.y + layout.cardHeight, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _drawFelt(ctx) {
    const w = this.renderer.logicalWidth;
    const h = this.renderer.logicalHeight;
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let gy = 0; gy < h; gy += 4) {
      for (let gx = 0; gx < w; gx += 4) {
        if ((gx + gy) % 8 === 0) {
          ctx.fillRect(gx, gy, 1, 1);
        }
      }
    }
  }
}

// Boot
try {
  const app = new App();
  window.__app = app;
} catch (e) {
  console.error('Fatal error:', e);
  const errorEl = document.getElementById('fatal-error');
  const msgEl = document.getElementById('error-message');
  if (errorEl && msgEl) {
    errorEl.hidden = false;
    msgEl.textContent = e.message || 'An unexpected error occurred.';
  }
}
