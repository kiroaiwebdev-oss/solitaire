/**
 * Daily challenge system.
 * Generates today's game from a deterministic seed, tracks completion,
 * streak counting, and streak bonuses.
 */

import { getDailySeed } from '../config/daily-seeds.js';

/**
 * Get today's date as a string (YYYY-MM-DD) for consistent key.
 * @param {Date} [date]
 * @returns {string}
 */
function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get yesterday's date key.
 * @param {Date} [date]
 * @returns {string}
 */
function yesterdayKey(date = new Date()) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return dateKey(yesterday);
}

export class DailyChallenge {
  constructor() {
    this.streak = 0;
    this.lastPlayed = null;
    this.lastCompleted = null;
    this.completed = false;
    this.totalCompleted = 0;
    this.longestStreak = 0;
  }

  /**
   * Get today's seed for the daily challenge.
   * @returns {number}
   */
  getTodaySeed() {
    return getDailySeed(new Date());
  }

  /**
   * Get seed for a specific date.
   * @param {Date} date
   * @returns {number}
   */
  getSeedForDate(date) {
    return getDailySeed(date);
  }

  /**
   * Check if today's challenge has been completed.
   * @returns {boolean}
   */
  isCompleted() {
    const today = dateKey();
    return this.lastCompleted === today;
  }

  /**
   * Mark today's challenge as completed. Updates streak.
   * @returns {{ streakBroken: boolean, newStreak: number }}
   */
  complete() {
    const today = dateKey();

    // Already completed today
    if (this.lastCompleted === today) {
      return { streakBroken: false, newStreak: this.streak };
    }

    const yesterday = yesterdayKey();
    let streakBroken = false;

    // Check if streak continues from yesterday
    if (this.lastCompleted === yesterday) {
      this.streak++;
    } else if (this.lastCompleted === null || this.lastCompleted !== today) {
      // Streak broken (or first ever completion)
      if (this.lastCompleted !== null && this.lastCompleted !== yesterday) {
        streakBroken = true;
      }
      this.streak = 1;
    }

    this.lastCompleted = today;
    this.lastPlayed = today;
    this.completed = true;
    this.totalCompleted++;

    if (this.streak > this.longestStreak) {
      this.longestStreak = this.streak;
    }

    return { streakBroken, newStreak: this.streak };
  }

  /**
   * Mark today as played (even if not won).
   */
  markPlayed() {
    this.lastPlayed = dateKey();
  }

  /**
   * Update streak status based on today's date.
   * If yesterday was not completed, streak is broken.
   */
  updateStreakStatus() {
    if (!this.lastCompleted) return;

    const today = dateKey();
    const yesterday = yesterdayKey();

    // If last completed is neither today nor yesterday, streak is broken
    if (this.lastCompleted !== today && this.lastCompleted !== yesterday) {
      this.streak = 0;
    }
  }

  /**
   * Get current streak count.
   * @returns {number}
   */
  getStreak() {
    this.updateStreakStatus();
    return this.streak;
  }

  /**
   * Load state from saved data.
   * @param {object} data
   */
  loadState(data) {
    if (!data) return;
    this.streak = data.streak || 0;
    this.lastPlayed = data.lastPlayed || null;
    this.lastCompleted = data.lastCompleted || null;
    this.completed = data.lastCompleted === dateKey();
    this.totalCompleted = data.totalCompleted || 0;
    this.longestStreak = data.longestStreak || 0;
    // Update streak on load
    this.updateStreakStatus();
  }

  /**
   * Get saveable state.
   * @returns {object}
   */
  getState() {
    return {
      streak: this.streak,
      lastPlayed: this.lastPlayed,
      lastCompleted: this.lastCompleted,
      totalCompleted: this.totalCompleted,
      longestStreak: this.longestStreak
    };
  }
}
