/**
 * Achievement tracking stub.
 * Full implementation in a later feature.
 */

export class Achievements {
  constructor() {
    this.unlocked = [];
  }

  check(event, data) {
    // Stub: no-op for now
  }

  getUnlocked() {
    return this.unlocked;
  }

  isUnlocked(id) {
    return this.unlocked.includes(id);
  }
}
