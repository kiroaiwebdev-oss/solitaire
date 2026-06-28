/**
 * Daily challenge system.
 * Generates today's game from a deterministic seed, tracks completion,
 * streak counting, calendar data, monthly tracking, and streak bonuses.
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

    // Calendar data: array of completed date strings
    this.completedDates = [];

    // Monthly tracking
    this.monthlyCompleted = {}; // { 'YYYY-MM': count }
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
   * @returns {{ streakBroken: boolean, newStreak: number, bonusMultiplier: number }}
   */
  complete() {
    const today = dateKey();

    // Already completed today
    if (this.lastCompleted === today) {
      return { streakBroken: false, newStreak: this.streak, bonusMultiplier: this._getStreakBonus() };
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

    // Track in calendar
    if (!this.completedDates.includes(today)) {
      this.completedDates.push(today);
    }

    // Monthly tracking
    const monthKey = today.substring(0, 7); // YYYY-MM
    this.monthlyCompleted[monthKey] = (this.monthlyCompleted[monthKey] || 0) + 1;

    if (this.streak > this.longestStreak) {
      this.longestStreak = this.streak;
    }

    return {
      streakBroken,
      newStreak: this.streak,
      bonusMultiplier: this._getStreakBonus()
    };
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
   * Get streak bonus multiplier.
   * Increases rewards based on current streak length.
   * @returns {number}
   */
  _getStreakBonus() {
    if (this.streak >= 30) return 3.0;
    if (this.streak >= 14) return 2.5;
    if (this.streak >= 7) return 2.0;
    if (this.streak >= 3) return 1.5;
    return 1.0;
  }

  /**
   * Get the streak bonus multiplier (public).
   * @returns {number}
   */
  getStreakBonus() {
    return this._getStreakBonus();
  }

  /**
   * Get calendar data for a given month.
   * @param {number} year
   * @param {number} month (0-11)
   * @returns {boolean[]} array of 31 booleans for each day
   */
  getCalendarMonth(year, month) {
    const days = new Array(31).fill(false);
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    for (const dateStr of this.completedDates) {
      if (dateStr.startsWith(monthStr)) {
        const day = parseInt(dateStr.substring(8, 10));
        days[day - 1] = true;
      }
    }
    return days;
  }

  /**
   * Get monthly completion count.
   * @param {number} year
   * @param {number} month (0-11)
   * @returns {number}
   */
  getMonthlyCount(year, month) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    return this.monthlyCompleted[key] || 0;
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
    this.completedDates = data.completedDates || [];
    this.monthlyCompleted = data.monthlyCompleted || {};
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
      longestStreak: this.longestStreak,
      completedDates: this.completedDates,
      monthlyCompleted: this.monthlyCompleted
    };
  }
}
