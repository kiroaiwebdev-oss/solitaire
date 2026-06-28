/**
 * Stock and Waste piles.
 * Supports draw-1 and draw-3 modes with recycle count tracking.
 */

export class Stock {
  constructor() {
    /** @type {import('./card.js').Card[]} */
    this.stock = [];
    /** @type {import('./card.js').Card[]} */
    this.waste = [];
    this.drawCount = 1; // 1 or 3
    this.recycleCount = 0; // How many times stock has been recycled
  }

  /**
   * Initialize stock with remaining cards after tableau deal.
   * @param {import('./card.js').Card[]} cards
   * @param {number} drawCount - 1 or 3
   */
  init(cards, drawCount = 1) {
    this.stock = [...cards];
    this.waste = [];
    this.drawCount = drawCount;
    this.recycleCount = 0;
    // All stock cards are face down
    for (const card of this.stock) {
      card.faceUp = false;
    }
  }

  /**
   * Draw cards from stock to waste.
   * @returns {import('./card.js').Card[]} the drawn cards
   */
  draw() {
    if (this.stock.length === 0) return [];
    const count = Math.min(this.drawCount, this.stock.length);
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = this.stock.pop();
      card.faceUp = true;
      this.waste.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  /**
   * Recycle waste back to stock (when stock is empty and user clicks stock).
   * @returns {boolean} whether recycle happened
   */
  recycle() {
    if (this.stock.length > 0) return false;
    while (this.waste.length > 0) {
      const card = this.waste.pop();
      card.faceUp = false;
      this.stock.push(card);
    }
    this.recycleCount++;
    return true;
  }

  /**
   * Get the top card of the waste pile (the one that can be played).
   * @returns {import('./card.js').Card | null}
   */
  topWaste() {
    return this.waste.length > 0 ? this.waste[this.waste.length - 1] : null;
  }

  /**
   * Remove the top card from waste (when it's placed somewhere).
   * @returns {import('./card.js').Card | null}
   */
  takeFromWaste() {
    return this.waste.length > 0 ? this.waste.pop() : null;
  }

  /**
   * Return a card to waste (for undo).
   */
  returnToWaste(card) {
    card.faceUp = true;
    this.waste.push(card);
  }

  /**
   * Check if stock is empty.
   */
  isEmpty() {
    return this.stock.length === 0;
  }

  /**
   * Check if waste is empty.
   */
  wasteEmpty() {
    return this.waste.length === 0;
  }

  /**
   * Get visible waste cards (for draw-3, show up to 3 fanned).
   * @returns {import('./card.js').Card[]}
   */
  visibleWaste() {
    if (this.drawCount === 1) {
      const top = this.topWaste();
      return top ? [top] : [];
    }
    // In draw-3, show up to 3 top waste cards fanned
    const count = Math.min(3, this.waste.length);
    return this.waste.slice(this.waste.length - count);
  }

  /**
   * Get total cards remaining in stock.
   * @returns {number}
   */
  stockCount() {
    return this.stock.length;
  }

  /**
   * Get total cards in waste.
   * @returns {number}
   */
  wasteCount() {
    return this.waste.length;
  }
}
