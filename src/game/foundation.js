/**
 * Foundation: 4 piles, one per suit.
 * Rules: Ace starts, same suit ascending.
 */

import { SUITS } from './card.js';

export class Foundation {
  constructor() {
    /** @type {import('./card.js').Card[][]} */
    this.piles = [[], [], [], []];
  }

  /**
   * Check if a card can be placed on a specific foundation pile.
   * @param {import('./card.js').Card} card
   * @param {number} pileIndex (0-3)
   * @returns {boolean}
   */
  canPlace(card, pileIndex) {
    const pile = this.piles[pileIndex];
    if (pile.length === 0) {
      return card.value === 1; // Only Aces on empty piles
    }
    const topCard = pile[pile.length - 1];
    return card.suit === topCard.suit && card.value === topCard.value + 1;
  }

  /**
   * Find which pile index a card can go to (auto-place).
   * Returns -1 if no valid pile found.
   * @param {import('./card.js').Card} card
   * @returns {number}
   */
  findValidPile(card) {
    for (let i = 0; i < 4; i++) {
      if (this.canPlace(card, i)) return i;
    }
    return -1;
  }

  /**
   * Place a card on a foundation pile.
   */
  placeCard(pileIndex, card) {
    card.faceUp = true;
    this.piles[pileIndex].push(card);
  }

  /**
   * Remove top card from a foundation pile.
   * @returns {import('./card.js').Card | null}
   */
  removeTop(pileIndex) {
    const pile = this.piles[pileIndex];
    return pile.length > 0 ? pile.pop() : null;
  }

  /**
   * Get top card of a pile (without removing).
   */
  topCard(pileIndex) {
    const pile = this.piles[pileIndex];
    return pile.length > 0 ? pile[pile.length - 1] : null;
  }

  /**
   * Check if all 52 cards are in foundations (win condition).
   */
  isComplete() {
    let total = 0;
    for (const pile of this.piles) {
      total += pile.length;
    }
    return total === 52;
  }

  /**
   * Total cards in all foundation piles.
   */
  totalCards() {
    let total = 0;
    for (const pile of this.piles) {
      total += pile.length;
    }
    return total;
  }

  /**
   * Find which pile a card belongs to.
   * @returns {{ pile: number, index: number } | null}
   */
  findCard(card) {
    for (let p = 0; p < 4; p++) {
      const idx = this.piles[p].indexOf(card);
      if (idx !== -1) return { pile: p, index: idx };
    }
    return null;
  }
}
