/**
 * Drag-and-drop system for cards.
 * Handles hit testing, picking up cards/sequences, visual follow,
 * tilt based on velocity, elastic snap-back, and drop validation.
 */

import { easeOutCubic, easeOutElastic, lerp } from '../core/math.js';

export class DragSystem {
  constructor() {
    /** @type {import('./card.js').Card[]} */
    this.cards = [];
    this.active = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.source = null; // { type: 'tableau'|'waste'|'foundation', index, cardIndex }
    this.returnPositions = []; // original positions for snap-back animation

    // Velocity tracking for tilt effect
    this.velocityX = 0;
    this.velocityY = 0;
    this._lastX = 0;
    this._lastY = 0;
    this._lastTime = 0;

    // Snap-back animation
    this._snapBacking = false;
    this._snapBackTime = 0;
    this._snapBackDuration = 0.35;
    this._snapBackStartPositions = [];
  }

  /**
   * Start dragging a set of cards from a source.
   * @param {import('./card.js').Card[]} cards
   * @param {number} pointerX
   * @param {number} pointerY
   * @param {{ type: string, index: number, cardIndex?: number }} source
   */
  start(cards, pointerX, pointerY, source) {
    if (cards.length === 0) return;
    this.cards = cards;
    this.active = true;
    this.source = source;
    this.offsetX = pointerX - cards[0].x;
    this.offsetY = pointerY - cards[0].y;
    this.returnPositions = cards.map(c => ({ x: c.x, y: c.y }));

    this.velocityX = 0;
    this.velocityY = 0;
    this._lastX = pointerX;
    this._lastY = pointerY;
    this._lastTime = performance.now();
    this._snapBacking = false;

    // Mark cards as dragging with elevated shadow
    for (const card of cards) {
      card.dragging = true;
      card.zIndex = 1000;
      card.targetElevation = 0.8;
    }
  }

  /**
   * Update card positions to follow pointer with tilt calculation.
   */
  move(pointerX, pointerY, cardHeight) {
    if (!this.active) return;

    const now = performance.now();
    const dt = Math.max(0.001, (now - this._lastTime) / 1000);

    // Calculate velocity for tilt
    this.velocityX = (pointerX - this._lastX) / dt;
    this.velocityY = (pointerY - this._lastY) / dt;
    this._lastX = pointerX;
    this._lastY = pointerY;
    this._lastTime = now;

    // Calculate tilt from horizontal velocity (clamped)
    const maxTilt = 0.15; // radians
    const tiltFactor = 0.0001;
    const targetTilt = Math.max(-maxTilt, Math.min(maxTilt, this.velocityX * tiltFactor));

    const stackOffset = cardHeight * 0.25;
    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].x = pointerX - this.offsetX;
      this.cards[i].y = pointerY - this.offsetY + i * stackOffset;
      this.cards[i].targetTilt = targetTilt;
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
      card.targetElevation = 0;
      card.targetTilt = 0;
    }
    this.active = false;
    return result;
  }

  /**
   * Animate cards back to their original positions with elastic bounce.
   */
  snapBack() {
    this._snapBacking = true;
    this._snapBackTime = 0;
    this._snapBackStartPositions = this.cards.map(c => ({ x: c.x, y: c.y }));

    for (let i = 0; i < this.cards.length; i++) {
      const pos = this.returnPositions[i];
      this.cards[i].animateTo(pos.x, pos.y, this._snapBackDuration);
      this.cards[i].dragging = false;
      this.cards[i].zIndex = 0;
      this.cards[i].targetElevation = 0;
      this.cards[i].targetTilt = 0;
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

  /**
   * Get the current drag velocity magnitude.
   * @returns {number}
   */
  getSpeed() {
    return Math.hypot(this.velocityX, this.velocityY);
  }
}
