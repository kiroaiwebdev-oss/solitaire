/**
 * Game orchestrator: state machine, deal, update, render, move validation,
 * scoring, undo, auto-complete, win animation, timer.
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
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

export class Game {
  constructor(options = {}) {
    this.state = GAME_STATES.PLAYING;
    this.tableau = new Tableau();
    this.foundation = new Foundation();
    this.stock = new Stock();
    this.drag = new DragSystem();
    this.drawCount = options.drawCount || 1;
    this.score = 0;
    this.moves = 0;
    this.timer = 0;
    this.hardMode = options.hardMode || false;
    this.hardModeTime = options.hardModeTime || 600; // 10 minutes
    this.undoState = null;
    this.winAnimationCards = [];
    this.winAnimTime = 0;
    this.autoCompleting = false;
    this.autoCompleteTimer = 0;
    this.seed = options.seed || null;
    this.onScoreChange = options.onScoreChange || null;
    this.onWin = options.onWin || null;
    this.onLose = options.onLose || null;
    this.audio = options.audio || null;
    this.allCards = [];
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
    this.score = 0;
    this.moves = 0;
    this.timer = 0;
    this.state = GAME_STATES.PLAYING;
    this.undoState = null;
    this.winAnimationCards = [];
    this.autoCompleting = false;

    // Collect all cards
    this.allCards = [];
    for (const col of this.tableau.columns) {
      for (const card of col) this.allCards.push(card);
    }
    for (const card of this.stock.stock) this.allCards.push(card);
    for (const card of this.stock.waste) this.allCards.push(card);
  }

  saveUndoState() {
    this.undoState = {
      tableauCols: this.tableau.columns.map(col =>
        col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      foundationPiles: this.foundation.piles.map(pile =>
        pile.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))
      ),
      stockCards: this.stock.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      wasteCards: this.stock.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      score: this.score,
      moves: this.moves
    };
  }

  undo() {
    if (!this.undoState) return false;
    // Rebuild state from snapshot
    const state = this.undoState;
    const allCards = [...this.allCards];

    const findCard = (suit, rank) => {
      return allCards.find(c => c.suit === suit && c.rank === rank);
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

    this.score = Math.max(0, state.score + SCORING.UNDO_PENALTY);
    this.moves = state.moves;
    this.undoState = null;

    if (this.audio) this.audio.play('undo');
    return true;
  }

  drawFromStock() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.saveUndoState();

    if (this.stock.isEmpty()) {
      if (!this.stock.wasteEmpty()) {
        this.stock.recycle();
        this.score = Math.max(0, this.score - 20); // penalty for recycle
        if (this.audio) this.audio.play('cardShuffle');
      }
    } else {
      this.stock.draw();
      if (this.audio) this.audio.play('cardFlip');
    }
    this.moves++;
  }

  /**
   * Try to move card(s) from waste to a target.
   */
  moveWasteToTableau(colIndex) {
    const card = this.stock.topWaste();
    if (!card) return false;
    if (!this.tableau.canPlace(card, colIndex)) return false;

    this.saveUndoState();
    this.stock.takeFromWaste();
    this.tableau.placeCard(colIndex, card);
    this.score += 5;
    this.moves++;
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
    this.score += 10;
    this.moves++;
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
    this.score += 10;
    this.moves++;
    if (this.audio) this.audio.play('cardPlace');
    this._checkWin();
    return true;
  }

  moveTableauToTableau(fromCol, cardIndex, toCol) {
    if (!this.tableau.canPickSequence(fromCol, cardIndex)) return false;
    const seq = this.tableau.getSequence(fromCol, cardIndex);
    if (seq.length === 0) return false;
    if (!this.tableau.canPlace(seq[0], toCol)) return false;

    this.saveUndoState();
    this.tableau.removeSequence(fromCol, cardIndex);
    this.tableau.placeSequence(toCol, seq);
    this.moves++;
    // Score for revealing a card
    const col = this.tableau.columns[fromCol];
    if (col.length > 0 && col[col.length - 1].faceUp) {
      this.score += 5;
    }
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
    this.score = Math.max(0, this.score - 15);
    this.moves++;
    if (this.audio) this.audio.play('cardPlace');
    return true;
  }

  _checkWin() {
    if (this.foundation.isComplete()) {
      this.state = GAME_STATES.WON;
      this.winAnimTime = 0;
      this._initWinAnimation();
      if (this.audio) this.audio.play('win');
      if (this.onWin) this.onWin(this.score, this.moves, this.timer);
    }
  }

  _initWinAnimation() {
    this.winAnimationCards = [];
    // Create flying card data from foundation piles
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

  /**
   * Check if auto-complete is possible:
   * All remaining cards are face up.
   */
  canAutoComplete() {
    if (this.stock.stock.length > 0) return false;
    if (this.stock.waste.length > 0) {
      // Check if all waste cards can eventually go to foundation
      // Simple check: all tableau cards are face up
    }
    return this.tableau.allFaceUp() && this.stock.stock.length === 0;
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
        this.score += 10;
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
          this.score += 10;
          if (this.audio) this.audio.play('cardPlace');
          this._checkWin();
          return true;
        }
      }
    }
    return false;
  }

  update(dt) {
    if (this.state === GAME_STATES.PLAYING) {
      this.timer += dt;

      // Hard mode time limit
      if (this.hardMode && this.timer >= this.hardModeTime) {
        this.state = GAME_STATES.LOST;
        if (this.onLose) this.onLose();
      }

      // Auto-complete
      if (this.autoCompleting) {
        this.autoCompleteTimer += dt;
        if (this.autoCompleteTimer >= 0.1) {
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

  startAutoComplete() {
    if (this.canAutoComplete()) {
      this.autoCompleting = true;
      this.autoCompleteTimer = 0;
    }
  }
}
