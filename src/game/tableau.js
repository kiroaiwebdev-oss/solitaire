/**
 * Tableau: 7 columns of cards.
 * Rules: alternating colors, descending rank. Empty columns accept Kings only.
 */

import { RANK_VALUES, isRed } from './card.js';

export class Tableau {
  constructor() {
    /** @type {import('./card.js').Card[][]} */
    this.columns = [[], [], [], [], [], [], []];
  }

  /**
   * Deal cards from a deck into 7 tableau columns.
   * Column i gets i+1 cards, top card face up.
   * @param {import('./card.js').Card[]} deck - cards will be removed from front
   */
  deal(deck) {
    this.columns = [[], [], [], [], [], [], []];
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck.shift();
        card.faceUp = (row === col);
        this.columns[col].push(card);
      }
    }
  }

  /**
   * Check if a card can be placed on a column.
   * @param {import('./card.js').Card} card
   * @param {number} colIndex
   * @returns {boolean}
   */
  canPlace(card, colIndex) {
    const col = this.columns[colIndex];
    if (col.length === 0) {
      // Empty column: only Kings
      return card.value === 13;
    }
    const topCard = col[col.length - 1];
    // Must be face up at top
    if (!topCard.faceUp) return false;
    // Alternating colors and descending rank
    const altColor = isRed(card.suit) !== isRed(topCard.suit);
    const descending = card.value === topCard.value - 1;
    return altColor && descending;
  }

  /**
   * Check if a sequence of cards (starting from card at given index in a column)
   * can be moved. Valid sequences are face-up, alternating colors, descending.
   * @param {number} colIndex
   * @param {number} cardIndex - index within the column
   * @returns {boolean}
   */
  canPickSequence(colIndex, cardIndex) {
    const col = this.columns[colIndex];
    if (cardIndex < 0 || cardIndex >= col.length) return false;
    // All cards from cardIndex to end must form a valid sequence
    for (let i = cardIndex; i < col.length; i++) {
      if (!col[i].faceUp) return false;
      if (i > cardIndex) {
        const prev = col[i - 1];
        const curr = col[i];
        if (isRed(prev.suit) === isRed(curr.suit)) return false;
        if (curr.value !== prev.value - 1) return false;
      }
    }
    return true;
  }

  /**
   * Get the sequence of cards from cardIndex to end of column.
   * Does NOT remove them (use removeSequence for that).
   */
  getSequence(colIndex, cardIndex) {
    return this.columns[colIndex].slice(cardIndex);
  }

  /**
   * Remove cards from cardIndex onward from a column.
   * Reveals the new top card if needed.
   * @returns {import('./card.js').Card[]} removed cards
   */
  removeSequence(colIndex, cardIndex) {
    const col = this.columns[colIndex];
    const removed = col.splice(cardIndex);
    // Reveal top card
    if (col.length > 0 && !col[col.length - 1].faceUp) {
      col[col.length - 1].faceUp = true;
    }
    return removed;
  }

  /**
   * Place a sequence of cards onto a column.
   */
  placeSequence(colIndex, cards) {
    for (const card of cards) {
      this.columns[colIndex].push(card);
    }
  }

  /**
   * Place a single card onto a column.
   */
  placeCard(colIndex, card) {
    this.columns[colIndex].push(card);
  }

  /**
   * Get top (last) card of a column, or null.
   */
  topCard(colIndex) {
    const col = this.columns[colIndex];
    return col.length > 0 ? col[col.length - 1] : null;
  }

  /**
   * Find which column and index a card is at.
   * @returns {{ col: number, index: number } | null}
   */
  findCard(card) {
    for (let c = 0; c < 7; c++) {
      const idx = this.columns[c].indexOf(card);
      if (idx !== -1) return { col: c, index: idx };
    }
    return null;
  }

  /**
   * Check if all face-down cards have been revealed.
   */
  allFaceUp() {
    for (const col of this.columns) {
      for (const card of col) {
        if (!card.faceUp) return false;
      }
    }
    return true;
  }
}
