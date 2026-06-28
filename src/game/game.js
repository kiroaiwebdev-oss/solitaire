/**
 * Game orchestrator: state machine, deal, update, render, move validation,
 * scoring, unlimited undo/redo, hint system, auto-complete with cascading
 * animation, move history, replay data, multiple difficulties, scoring modes,
 * win animation, timer.
 */

import { createDeck, shuffle, createSeededDeck } from './deck.js';
import { Tableau } from './tableau.js';
import { Foundation } from './foundation.js';
import { Stock } from './stock.js';
import { DragSystem } from './drag.js';
import { SUITS, RANKS } from './card.js';
import { SCORING } from '../config/scoring.js';

export const GAME_STATES = {
  MENU: 'menu',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

export const DIFFICULTY = {
  EASY: 'easy',       // draw-1, no timer
  MEDIUM: 'medium',   // draw-1, 10 min timer
  HARD: 'hard',       // draw-3, no timer
  EXPERT: 'expert'    // draw-3, 5 min timer
};

export const SCORING_MODE = {
  STANDARD: 'standard',
  VEGAS: 'vegas',
  NONE: 'none'
};

export class Game {
  constructor(options = {}) {
    this.state = GAME_STATES.PLAYING;
    this.tableau = new Tableau();
    this.foundation = new Foundation();
    this.stock = new Stock();
    this.drag = new DragSystem();

    // Difficulty settings
    this.difficulty = options.difficulty || DIFFICULTY.EASY;
    this.scoringMode = options.scoringMode || SCORING_MODE.STANDARD;
    this.drawCount = options.drawCount || this._getDrawCount();
    this.hardMode = options.hardMode || this._isTimed();
    this.hardModeTime = options.hardModeTime || this._getTimeLimit();

    // Game state
    this.score = 0;
    this.moves = 0;
    this.timer = 0;
    this.timerCountsDown = this._isTimed();
    this.seed = options.seed || null;

    // Unlimited undo/redo
    this._undoStack = [];
    this._redoStack = [];
    this._maxUndoStates = 500;

    // Legacy single undo (for backwards compatibility with tests)
    this.undoState = null;

    // Move history (for replay)
    this.moveHistory = [];

    // Replay data
    this.replayData = {
      seed: this.seed,
      difficulty: this.difficulty,
      scoringMode: this.scoringMode,
      drawCount: this.drawCount,
      moves: []
    };

    // Hint system
    this._hints = [];
    this._currentHintIndex = 0;

    // Auto-complete
    this.autoCompleting = false;
    this.autoCompleteTimer = 0;
    this.autoCompleteInterval = 0.1; // seconds between auto-complete moves

    // Win animation
    this.winAnimationCards = [];
    this.winAnimTime = 0;

    // Callbacks
    this.onScoreChange = options.onScoreChange || null;
    this.onWin = options.onWin || null;
    this.onLose = options.onLose || null;
    this.audio = options.audio || null;

    // All cards reference
    this.allCards = [];

    // Stats tracking for this game
    this.usedUndo = false;
    this.usedStock = false;
    this.foundationHistory = []; // track when foundation was last at 0
  }

  _getDrawCount() {
    if (this.difficulty === DIFFICULTY.HARD || this.difficulty === DIFFICULTY.EXPERT) return 3;
    return 1;
  }

  _isTimed() {
    return this.difficulty === DIFFICULTY.MEDIUM || this.difficulty === DIFFICULTY.EXPERT;
  }

  _getTimeLimit() {
    if (this.difficulty === DIFFICULTY.MEDIUM) return 600; // 10 minutes
    if (this.difficulty === DIFFICULTY.EXPERT) return 300; // 5 minutes
    return Infinity;
  }

  deal() {
    let deck;
    if (this.seed !== null) {
      deck = createSeededDeck(this.seed);
    } else {
      deck = createDeck();
      shuffle(deck);
    }

    this.tableau.deal(deck);
    this.stock.init(deck, this.drawCount);

    // Initialize score based on scoring mode
    if (this.scoringMode === SCORING_MODE.VEGAS) {
      this.score = -52;
    } else {
      this.score = 0;
    }

    this.moves = 0;
    this.timer = this.timerCountsDown ? this.hardModeTime : 0;
    this.state = GAME_STATES.PLAYING;
    this._undoStack = [];
    this._redoStack = [];
    this.undoState = null;
    this.winAnimationCards = [];
    this.autoCompleting = false;
    this.moveHistory = [];
    this.usedUndo = false;
    this.usedStock = false;
    this.foundationHistory = [];

    // Update replay data
    this.replayData = {
      seed: this.seed,
      difficulty: this.difficulty,
      scoringMode: this.scoringMode,
      drawCount: this.drawCount,
      moves: []
    };

    // Collect all cards
    this.allCards = [];
    for (const col of this.tableau.columns) {
      for (const card of col) this.allCards.push(card);
    }
    for (const card of this.stock.stock) this.allCards.push(card);
    for (const card of this.stock.waste) this.allCards.push(card);
  }

  // --- State Snapshots for Undo/Redo ---

  _captureState() {
    return {
      tableauCols: this.tableau.columns.map(col =>
        col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      foundationPiles: this.foundation.piles.map(pile =>
        pile.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      stockCards: this.stock.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      wasteCards: this.stock.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      score: this.score,
      moves: this.moves,
      recycleCount: this.stock.recycleCount
    };
  }

  _restoreState(state) {
    const findCard = (suit, rank) => {
      return this.allCards.find(c => c.suit === suit && c.rank === rank);
    };

    // Clear all piles
    this.tableau.columns = [[], [], [], [], [], [], []];
    this.foundation.piles = [[], [], [], []];
    this.stock.stock = [];
    this.stock.waste = [];

    // Restore tableau
    for (let c = 0; c < 7; c++) {
      for (const cardData of state.tableauCols[c]) {
        const card = findCard(cardData.suit, cardData.rank);
        if (card) {
          card.faceUp = cardData.faceUp;
          this.tableau.columns[c].push(card);
        }
      }
    }

    // Restore foundation
    for (let p = 0; p < 4; p++) {
      for (const cardData of state.foundationPiles[p]) {
        const card = findCard(cardData.suit, cardData.rank);
        if (card) {
          card.faceUp = cardData.faceUp;
          this.foundation.piles[p].push(card);
        }
      }
    }

    // Restore stock
    for (const cardData of state.stockCards) {
      const card = findCard(cardData.suit, cardData.rank);
      if (card) {
        card.faceUp = cardData.faceUp;
        this.stock.stock.push(card);
      }
    }

    // Restore waste
    for (const cardData of state.wasteCards) {
      const card = findCard(cardData.suit, cardData.rank);
      if (card) {
        card.faceUp = cardData.faceUp;
        this.stock.waste.push(card);
      }
    }

    this.score = state.score;
    this.moves = state.moves;
    this.stock.recycleCount = state.recycleCount || 0;
  }

  saveUndoState() {
    const state = this._captureState();
    this._undoStack.push(state);
    if (this._undoStack.length > this._maxUndoStates) {
      this._undoStack.shift();
    }
    // Clear redo stack on new action
    this._redoStack = [];
    // Also save as single undoState for backward compat
    this.undoState = state;
  }

  undo() {
    if (this._undoStack.length === 0 && !this.undoState) return false;

    const state = this._undoStack.pop() || this.undoState;
    if (!state) return false;

    // Save current state to redo stack
    this._redoStack.push(this._captureState());

    this._restoreState(state);

    // Score is already restored to pre-move value (implicit penalty of losing earned points)
    // No additional penalty applied

    this.undoState = this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1] : null;
    this.usedUndo = true;

    // Record in move history
    this._recordMove('undo', null, null);

    if (this.audio) this.audio.play('undo');
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;

    const state = this._redoStack.pop();
    this._undoStack.push(this._captureState());
    this._restoreState(state);

    this._recordMove('redo', null, null);

    if (this.audio) this.audio.play('redo');
    return true;
  }

  /**
   * Check how many undo states are available.
   */
  canUndo() {
    return this._undoStack.length > 0 || this.undoState !== null;
  }

  /**
   * Check if redo is available.
   */
  canRedo() {
    return this._redoStack.length > 0;
  }

  // --- Move Recording ---

  _recordMove(type, from, to, extra = {}) {
    const move = {
      type,
      from,
      to,
      timestamp: this.timer,
      ...extra
    };
    this.moveHistory.push(move);
    this.replayData.moves.push(move);
  }

  // --- Moves ---

  drawFromStock() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.saveUndoState();

    if (this.stock.isEmpty()) {
      if (!this.stock.wasteEmpty()) {
        this.stock.recycle();
        if (this.scoringMode === SCORING_MODE.STANDARD) {
          this.score = Math.max(0, this.score + SCORING.RECYCLE_STOCK);
        }
        this._recordMove('recycle', 'waste', 'stock');
        if (this.audio) this.audio.play('cardShuffle');
      }
    } else {
      this.stock.draw();
      this.usedStock = true;
      this._recordMove('draw', 'stock', 'waste');
      if (this.audio) this.audio.play('cardFlip');
    }
    this.moves++;
  }

  moveWasteToTableau(colIndex) {
    const card = this.stock.topWaste();
    if (!card) return false;
    if (!this.tableau.canPlace(card, colIndex)) return false;

    this.saveUndoState();
    this.stock.takeFromWaste();
    this.tableau.placeCard(colIndex, card);
    this._addScore(SCORING.WASTE_TO_TABLEAU);
    this.moves++;
    this._recordMove('wasteToTableau', 'waste', `tableau_${colIndex}`, { card: card.toString() });
    if (this.audio) this.audio.play('cardPlace');
    return true;
  }

  moveWasteToFoundation() {
    const card = this.stock.topWaste();
    if (!card) return false;
    const pileIdx = this.foundation.findValidPile(card);
    if (pileIdx === -1) return false;

    this.saveUndoState();
    this.stock.takeFromWaste();
    this.foundation.placeCard(pileIdx, card);
    this._addScore(SCORING.WASTE_TO_FOUNDATION);
    this.moves++;
    this._recordMove('wasteToFoundation', 'waste', `foundation_${pileIdx}`, { card: card.toString() });
    if (this.audio) this.audio.play('cardPlace');
    this._checkWin();
    return true;
  }

  moveTableauToFoundation(colIndex) {
    const card = this.tableau.topCard(colIndex);
    if (!card || !card.faceUp) return false;
    const pileIdx = this.foundation.findValidPile(card);
    if (pileIdx === -1) return false;

    this.saveUndoState();
    this.tableau.removeSequence(colIndex, this.tableau.columns[colIndex].length - 1);
    this.foundation.placeCard(pileIdx, card);
    this._addScore(SCORING.TABLEAU_TO_FOUNDATION);
    this.moves++;
    this._recordMove('tableauToFoundation', `tableau_${colIndex}`, `foundation_${pileIdx}`, { card: card.toString() });
    if (this.audio) this.audio.play('cardPlace');
    this._checkWin();
    return true;
  }

  moveTableauToTableau(fromCol, cardIndex, toCol) {
    if (!this.tableau.canPickSequence(fromCol, cardIndex)) return false;
    const seq = this.tableau.getSequence(fromCol, cardIndex);
    if (seq.length === 0) return false;
    if (!this.tableau.canPlace(seq[0], toCol)) return false;

    // Check if the card that will be exposed was face-down
    const col = this.tableau.columns[fromCol];
    const newTopIndex = cardIndex - 1;
    const willReveal = newTopIndex >= 0 && !col[newTopIndex].faceUp;

    this.saveUndoState();
    this.tableau.removeSequence(fromCol, cardIndex);
    this.tableau.placeSequence(toCol, seq);
    this.moves++;

    // Score for revealing a card
    if (willReveal) {
      this._addScore(SCORING.REVEAL_CARD);
    }

    this._recordMove('tableauToTableau', `tableau_${fromCol}`, `tableau_${toCol}`, {
      cardIndex,
      cards: seq.map(c => c.toString()),
      revealed: willReveal
    });
    if (this.audio) this.audio.play('cardPlace');
    return true;
  }

  moveFoundationToTableau(pileIndex, colIndex) {
    const card = this.foundation.topCard(pileIndex);
    if (!card) return false;
    if (!this.tableau.canPlace(card, colIndex)) return false;

    this.saveUndoState();
    this.foundation.removeTop(pileIndex);
    this.tableau.placeCard(colIndex, card);
    this._addScore(SCORING.FOUNDATION_TO_TABLEAU);
    this.moves++;
    this._recordMove('foundationToTableau', `foundation_${pileIndex}`, `tableau_${colIndex}`, { card: card.toString() });
    if (this.audio) this.audio.play('cardPlace');
    return true;
  }

  /**
   * Double-tap auto-move: try to move a card to foundation.
   * @param {import('./card.js').Card} card
   * @returns {boolean}
   */
  autoMoveToFoundation(card) {
    // Find where the card is
    const tableauLoc = this.tableau.findCard(card);
    if (tableauLoc) {
      // Can only auto-move the top card of a column
      const col = this.tableau.columns[tableauLoc.col];
      if (tableauLoc.index === col.length - 1) {
        return this.moveTableauToFoundation(tableauLoc.col);
      }
    }

    // Check waste
    const wasteTop = this.stock.topWaste();
    if (wasteTop === card) {
      return this.moveWasteToFoundation();
    }

    return false;
  }

  // --- Scoring ---

  _addScore(amount) {
    if (this.scoringMode === SCORING_MODE.NONE) return;

    if (this.scoringMode === SCORING_MODE.VEGAS) {
      // Vegas: only +5 for foundation moves
      if (amount === SCORING.WASTE_TO_FOUNDATION || amount === SCORING.TABLEAU_TO_FOUNDATION) {
        this.score += 5;
      }
      // No penalties in Vegas mode except recycle (handled separately)
    } else {
      // Standard scoring
      this.score += amount;
      if (this.score < 0) this.score = 0;
    }

    if (this.onScoreChange) this.onScoreChange(this.score);
  }

  /**
   * Calculate time bonus at end of game (standard scoring only).
   */
  getTimeBonus() {
    if (this.scoringMode !== SCORING_MODE.STANDARD) return 0;
    if (this.timer <= 0) return 0;
    if (this.timer < SCORING.TIME_BONUS_THRESHOLD) {
      return Math.floor((SCORING.TIME_BONUS_THRESHOLD - this.timer) * SCORING.TIME_BONUS_MULTIPLIER);
    }
    return 0;
  }

  // --- Win Detection ---

  _checkWin() {
    if (this.foundation.isComplete()) {
      this.state = GAME_STATES.WON;
      this.winAnimTime = 0;
      // Add time bonus
      const timeBonus = this.getTimeBonus();
      this.score += timeBonus;
      this._initWinAnimation();
      if (this.audio) this.audio.play('win');
      if (this.onWin) this.onWin(this.score, this.moves, this.timer);
    }
  }

  _initWinAnimation() {
    this.winAnimationCards = [];
    for (let p = 0; p < 4; p++) {
      const pile = this.foundation.piles[p];
      for (let i = pile.length - 1; i >= 0; i--) {
        const card = pile[i];
        this.winAnimationCards.push({
          card,
          x: card.x || 0,
          y: card.y || 0,
          vx: (Math.random() - 0.5) * 400,
          vy: -(Math.random() * 200 + 100),
          gravity: 600,
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 5,
          delay: (pile.length - 1 - i) * 0.08 + p * 0.3,
          launched: false,
          bounces: 0
        });
      }
    }
  }

  updateWinAnimation(dt, screenWidth, screenHeight, cardWidth, cardHeight) {
    if (this.state !== GAME_STATES.WON) return;
    this.winAnimTime += dt;

    for (const data of this.winAnimationCards) {
      if (this.winAnimTime < data.delay) continue;
      if (!data.launched) {
        data.launched = true;
        data.x = data.card.x || 0;
        data.y = data.card.y || 0;
      }
      data.vy += data.gravity * dt;
      data.x += data.vx * dt;
      data.y += data.vy * dt;
      data.rotation += data.rotationSpeed * dt;

      // Bounce off bottom
      if (data.y + cardHeight > screenHeight) {
        data.y = screenHeight - cardHeight;
        data.vy *= -0.6;
        data.vx *= 0.9;
        data.bounces++;
      }
      // Bounce off sides
      if (data.x < 0) { data.x = 0; data.vx *= -0.8; }
      if (data.x + cardWidth > screenWidth) { data.x = screenWidth - cardWidth; data.vx *= -0.8; }
    }
  }

  // --- Hint System ---

  /**
   * Find all valid moves (hints).
   * @returns {Array<{from: object, to: object, cards: Card[]}>}
   */
  findHints() {
    const hints = [];

    // Waste to foundation
    const wasteCard = this.stock.topWaste();
    if (wasteCard) {
      const pileIdx = this.foundation.findValidPile(wasteCard);
      if (pileIdx !== -1) {
        hints.push({
          from: { type: 'waste' },
          to: { type: 'foundation', index: pileIdx },
          cards: [wasteCard]
        });
      }
      // Waste to tableau
      for (let c = 0; c < 7; c++) {
        if (this.tableau.canPlace(wasteCard, c)) {
          hints.push({
            from: { type: 'waste' },
            to: { type: 'tableau', col: c },
            cards: [wasteCard]
          });
        }
      }
    }

    // Tableau to foundation
    for (let c = 0; c < 7; c++) {
      const topCard = this.tableau.topCard(c);
      if (topCard && topCard.faceUp) {
        const pileIdx = this.foundation.findValidPile(topCard);
        if (pileIdx !== -1) {
          hints.push({
            from: { type: 'tableau', col: c },
            to: { type: 'foundation', index: pileIdx },
            cards: [topCard]
          });
        }
      }
    }

    // Tableau to tableau (all valid sequence moves)
    const tableauHints = this.tableau.getHints(this.foundation);
    for (const h of tableauHints) {
      if (h.to.foundation !== undefined) continue; // already handled above
      hints.push({
        from: { type: 'tableau', col: h.from.col, index: h.from.index },
        to: { type: 'tableau', col: h.to.col },
        cards: h.cards
      });
    }

    this._hints = hints;
    return hints;
  }

  /**
   * Get next hint (cycles through available hints).
   */
  getNextHint() {
    if (this._hints.length === 0) {
      this.findHints();
    }
    if (this._hints.length === 0) return null;
    const hint = this._hints[this._currentHintIndex % this._hints.length];
    this._currentHintIndex++;
    return hint;
  }

  // --- Auto-Complete ---

  /**
   * Check if auto-complete is possible:
   * Stock and waste must both be empty, and all tableau cards face up.
   */
  canAutoComplete() {
    if (this.stock.stock.length > 0) return false;
    if (this.stock.waste.length > 0) return false;
    return this.tableau.allFaceUp();
  }

  /**
   * Perform one step of auto-complete.
   * @returns {boolean} true if a card was moved
   */
  autoCompleteStep() {
    // Try waste to foundation
    const wasteCard = this.stock.topWaste();
    if (wasteCard) {
      const pileIdx = this.foundation.findValidPile(wasteCard);
      if (pileIdx !== -1) {
        this.stock.takeFromWaste();
        this.foundation.placeCard(pileIdx, wasteCard);
        this._addScore(SCORING.TABLEAU_TO_FOUNDATION);
        if (this.audio) this.audio.play('cardPlace');
        this._checkWin();
        return true;
      }
    }

    // Try tableau to foundation
    for (let c = 0; c < 7; c++) {
      const card = this.tableau.topCard(c);
      if (card && card.faceUp) {
        const pileIdx = this.foundation.findValidPile(card);
        if (pileIdx !== -1) {
          this.tableau.removeSequence(c, this.tableau.columns[c].length - 1);
          this.foundation.placeCard(pileIdx, card);
          this._addScore(SCORING.TABLEAU_TO_FOUNDATION);
          if (this.audio) this.audio.play('cardPlace');
          this._checkWin();
          return true;
        }
      }
    }
    return false;
  }

  startAutoComplete() {
    if (this.canAutoComplete()) {
      this.autoCompleting = true;
      this.autoCompleteTimer = 0;
      if (this.audio) this.audio.play('autoComplete');
    }
  }

  // --- Update ---

  update(dt) {
    if (this.state === GAME_STATES.PLAYING) {
      // Timer
      if (this.timerCountsDown) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.state = GAME_STATES.LOST;
          if (this.onLose) this.onLose();
        }
      } else {
        this.timer += dt;
      }

      // Hard mode time limit (legacy support)
      if (this.hardMode && !this.timerCountsDown && this.timer >= this.hardModeTime) {
        this.state = GAME_STATES.LOST;
        if (this.onLose) this.onLose();
      }

      // Auto-complete
      if (this.autoCompleting) {
        this.autoCompleteTimer += dt;
        if (this.autoCompleteTimer >= this.autoCompleteInterval) {
          this.autoCompleteTimer = 0;
          if (!this.autoCompleteStep()) {
            this.autoCompleting = false;
          }
        }
      }
    }

    // Update card animations
    for (const card of this.allCards) {
      card.update(dt);
    }
  }

  // --- Serialization ---

  /**
   * Get game state for saving.
   */
  getSerializableState() {
    return {
      state: this.state,
      score: this.score,
      moves: this.moves,
      timer: this.timer,
      difficulty: this.difficulty,
      scoringMode: this.scoringMode,
      drawCount: this.drawCount,
      seed: this.seed,
      usedUndo: this.usedUndo,
      usedStock: this.usedStock,
      tableau: this.tableau.columns.map(col =>
        col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      foundation: this.foundation.piles.map(pile =>
        pile.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      stock: this.stock.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: this.stock.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      recycleCount: this.stock.recycleCount,
      moveHistory: this.moveHistory
    };
  }

  /**
   * Get the replay data for this game.
   */
  getReplayData() {
    return { ...this.replayData };
  }
}
