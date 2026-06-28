/**
 * Deck generation and shuffling.
 */

import { Card, SUITS, RANKS } from './card.js';
import { createRng } from '../core/math.js';

/**
 * Generate a standard 52-card deck.
 */
export function createDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(new Card(suit, rank));
    }
  }
  return cards;
}

/**
 * Fisher-Yates shuffle (in-place).
 * @param {Card[]} cards
 * @param {Function} rngFn - random function returning [0,1)
 * @returns {Card[]} the same array, shuffled
 */
export function shuffle(cards, rngFn = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * Create a shuffled deck with a seed (for daily challenges).
 * @param {number} seed
 * @returns {Card[]}
 */
export function createSeededDeck(seed) {
  const cards = createDeck();
  const rng = createRng(seed);
  return shuffle(cards, rng);
}
