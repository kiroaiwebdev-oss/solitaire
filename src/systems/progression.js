/**
 * Progression system: XP, levels, and currency.
 * XP earned per game with bonuses. Exponential level thresholds.
 */

const BASE_XP_PER_GAME = 10;
const WIN_BONUS_XP = 50;
const SPEED_BONUS_THRESHOLD = 180; // seconds - under 3 min
const SPEED_BONUS_XP = 30;
const NO_UNDO_BONUS_XP = 20;
const STREAK_BONUS_XP = 10; // per day of streak
const COINS_PER_LEVEL = 100;

/**
 * Calculate XP required to reach a given level.
 * Uses exponential curve: XP = 100 * level^1.5
 * @param {number} level
 * @returns {number}
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

/**
 * Calculate total XP required for a given level (cumulative).
 * @param {number} level
 * @returns {number}
 */
export function totalXpForLevel(level) {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Get the level for a given total XP amount.
 * @param {number} totalXp
 * @returns {number}
 */
export function levelFromXp(totalXp) {
  let level = 1;
  let accumulated = 0;
  while (true) {
    const needed = xpForLevel(level + 1);
    if (accumulated + needed > totalXp) break;
    accumulated += needed;
    level++;
    if (level > 999) break; // safety
  }
  return level;
}

/**
 * Calculate XP earned for a game result.
 * @param {object} result - { won, time, usedUndo, streak }
 * @returns {number}
 */
export function calculateGameXp(result) {
  let xp = BASE_XP_PER_GAME;
  if (result.won) {
    xp += WIN_BONUS_XP;
    if (result.time < SPEED_BONUS_THRESHOLD) {
      xp += SPEED_BONUS_XP;
    }
    if (!result.usedUndo) {
      xp += NO_UNDO_BONUS_XP;
    }
  }
  if (result.streak && result.streak > 0) {
    xp += Math.min(result.streak, 30) * STREAK_BONUS_XP;
  }
  return xp;
}

export class Progression {
  constructor() {
    this.xp = 0;
    this.level = 1;
    this.currency = 0;
    this.totalXpEarned = 0;
  }

  /**
   * Add XP and check for level-ups. Returns level-up info if leveled.
   * @param {number} amount
   * @returns {{ leveled: boolean, newLevel: number, coinsEarned: number }}
   */
  addXp(amount) {
    this.xp += amount;
    this.totalXpEarned += amount;
    const oldLevel = this.level;
    const newLevel = levelFromXp(this.xp);
    let coinsEarned = 0;

    if (newLevel > oldLevel) {
      const levelsGained = newLevel - oldLevel;
      coinsEarned = levelsGained * COINS_PER_LEVEL;
      this.currency += coinsEarned;
      this.level = newLevel;
      return { leveled: true, newLevel, coinsEarned };
    }

    this.level = newLevel;
    return { leveled: false, newLevel: this.level, coinsEarned: 0 };
  }

  addCurrency(amount) {
    this.currency += amount;
  }

  getLevel() {
    return this.level;
  }

  /**
   * Get progress toward the next level (0-1).
   * @returns {number}
   */
  getLevelProgress() {
    const currentLevelXp = totalXpForLevel(this.level);
    const nextLevelXp = totalXpForLevel(this.level + 1);
    const needed = nextLevelXp - currentLevelXp;
    if (needed <= 0) return 1;
    const current = this.xp - currentLevelXp;
    return Math.min(Math.max(current / needed, 0), 1);
  }

  /**
   * Load state from saved data.
   * @param {object} data
   */
  loadState(data) {
    if (!data) return;
    this.xp = data.xp || 0;
    this.level = data.level || 1;
    this.currency = data.currency || 0;
    this.totalXpEarned = data.totalXpEarned || 0;
    // Recalculate level from XP for safety
    this.level = levelFromXp(this.xp);
  }

  /**
   * Get saveable state.
   * @returns {object}
   */
  getState() {
    return {
      xp: this.xp,
      level: this.level,
      currency: this.currency,
      totalXpEarned: this.totalXpEarned
    };
  }

  reset() {
    this.xp = 0;
    this.level = 1;
    this.currency = 0;
    this.totalXpEarned = 0;
  }
}
