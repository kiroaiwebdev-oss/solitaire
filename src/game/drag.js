/**
 * Drag-and-drop system for cards.
 * Handles hit testing, picking up cards/sequences, visual follow, and drop validation.
 */

import { easeOutCubic, lerp } from '../core/math.js';

export class DragSystem {
  constructor() {
    /** @type {import('./card.js').Card[]} */
    this.cards = [];
    this.active = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.source = null; // { type: 'tableau'|'waste'|'foundation', col/pile index }
    this.returnPositions = []; // original positions for snap-back animation
  }

  /**
   * Start dragging a set of cards from a source.
   * @param {import('./card.js').Card[]} cards
   * @param {number} pointerX
   * @param {number} pointerY
   * @param {{ type: string, index: number }} source
   */
  start(cards, pointerX, pointerY, source) {
    if (cards.length === 0) return;
    this.cards = cards;
    this.active = true;
    this.source = source;
    this.offsetX = pointerX - cards[0].x;
    this.offsetY = pointerY - cards[0].y;
    this.returnPositions = cards.map(c => ({ x: c.x, y: c.y }));

    // Mark cards as dragging
    for (const card of cards) {
      card.dragging = true;
      card.zIndex = 1000;
    }
  }

  /**
   * Update card positions to follow pointer.
   */
  move(pointerX, pointerY, cardHeight) {
    if (!this.active) return;
    const stackOffset = cardHeight * 0.25;
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].x = pointerX - this.offsetX;
      this.cards[i].y = pointerY - this.offsetY + i * stackOffset;
    }
  }

  /**
   * End drag. Returns the cards so the game can decide what to do with them.
   * @returns {{ cards: import('./card.js').Card[], source: object }}
   */
  end() {
    const result = { cards: this.cards, source: this.source };
    for (const card of this.cards) {
      card.dragging = false;
      card.zIndex = 0;
    }
    this.active = false;
    return result;
  }

  /**
   * Animate cards back to their original positions (invalid drop).
   */
  snapBack() {
    for (let i = 0; i < this.cards.length; i++) {
      const pos = this.returnPositions[i];
      this.cards[i].animateTo(pos.x, pos.y, 0.2);
      this.cards[i].dragging = false;
      this.cards[i].zIndex = 0;
    }
    this.active = false;
    this.cards = [];
    this.source = null;
  }

  /**
   * Cancel current drag and snap cards back.
   */
  cancel() {
    if (!this.active) return;
    this.snapBack();
  }
}
