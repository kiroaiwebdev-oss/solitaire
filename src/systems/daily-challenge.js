/**
 * Daily challenge system stub.
 * Full implementation in a later feature.
 */

export class DailyChallenge {
  constructor() {
    this.streak = 0;
    this.lastPlayed = null;
    this.completed = false;
  }

  getTodaySeed() {
    const now = new Date();
    return ((now.getFullYear() * 31 + now.getMonth()) * 31 + now.getDate()) * 2654435761 >>> 0;
  }

  isCompleted() {
    return this.completed;
  }

  complete() {
    this.completed = true;
    this.streak++;
    this.lastPlayed = new Date().toDateString();
  }

  getStreak() {
    return this.streak;
  }
}
