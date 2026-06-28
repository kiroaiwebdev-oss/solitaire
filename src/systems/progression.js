/**
 * Progression system stub.
 * Full implementation in a later feature.
 */

export class Progression {
  constructor() {
    this.xp = 0;
    this.level = 1;
    this.currency = 0;
  }

  addXp(amount) {
    this.xp += amount;
  }

  addCurrency(amount) {
    this.currency += amount;
  }

  getLevel() {
    return this.level;
  }

  reset() {
    this.xp = 0;
    this.level = 1;
    this.currency = 0;
  }
}
