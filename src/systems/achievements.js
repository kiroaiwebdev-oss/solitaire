/**
 * Achievement tracking system.
 * Checks conditions after each game, unlocks achievements,
 * manages notification queue, and tracks progress.
 */

import { ACHIEVEMENT_DEFS, getAllAchievementIds, ACHIEVEMENT_CATEGORIES } from '../config/achievements.js';

export class Achievements {
  constructor() {
    this.unlocked = [];
    this._pendingNotifications = [];
    this._unlockTimes = {}; // id -> timestamp
  }

  /**
   * Check all achievement conditions against current stats.
   * Unlocks any newly earned achievements.
   * @param {object} stats - current game stats for condition checking
   * @returns {string[]} - array of newly unlocked achievement IDs
   */
  check(stats) {
    const newlyUnlocked = [];
    const allIds = getAllAchievementIds();

    for (const id of allIds) {
      if (this.unlocked.includes(id)) continue;
      const def = ACHIEVEMENT_DEFS[id];
      if (def && def.check(stats)) {
        this.unlocked.push(id);
        newlyUnlocked.push(id);
        this._pendingNotifications.push(id);
        this._unlockTimes[id] = Date.now();
      }
    }

    return newlyUnlocked;
  }

  /**
   * Manually unlock an achievement (for special conditions).
   * @param {string} id
   * @returns {boolean} whether it was newly unlocked
   */
  unlock(id) {
    if (this.unlocked.includes(id)) return false;
    if (!ACHIEVEMENT_DEFS[id]) return false;
    this.unlocked.push(id);
    this._pendingNotifications.push(id);
    this._unlockTimes[id] = Date.now();
    return true;
  }

  /**
   * Get all unlocked achievement IDs.
   * @returns {string[]}
   */
  getUnlocked() {
    return [...this.unlocked];
  }

  /**
   * Check if a specific achievement is unlocked.
   * @param {string} id
   * @returns {boolean}
   */
  isUnlocked(id) {
    return this.unlocked.includes(id);
  }

  /**
   * Get pending notification (pop one). Returns null if none.
   * @returns {object|null} - { id, name, icon, description, category, rarity }
   */
  popNotification() {
    if (this._pendingNotifications.length === 0) return null;
    const id = this._pendingNotifications.shift();
    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return null;
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      description: def.description,
      category: def.category,
      rarity: def.rarity
    };
  }

  /**
   * Check if there are pending notifications.
   * @returns {boolean}
   */
  hasNotifications() {
    return this._pendingNotifications.length > 0;
  }

  /**
   * Get progress info for all achievements with partial progress bars.
   * @param {object} stats
   * @returns {Array<{ id, name, icon, description, category, rarity, unlocked, progress }>}
   */
  getProgress(stats) {
    const allIds = getAllAchievementIds();
    return allIds.map(id => {
      const def = ACHIEVEMENT_DEFS[id];
      const unlocked = this.unlocked.includes(id);
      let progress = unlocked ? 1 : 0;

      // Calculate partial progress for specific achievements
      if (!unlocked) {
        progress = this._calculateProgress(id, stats);
      }

      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        category: def.category,
        rarity: def.rarity,
        unlocked,
        progress,
        unlockTime: this._unlockTimes[id] || null
      };
    });
  }

  /**
   * Calculate partial progress for an achievement.
   * @param {string} id
   * @param {object} stats
   * @returns {number} 0-1
   */
  _calculateProgress(id, stats) {
    switch (id) {
      case 'first_win': return Math.min(1, (stats.won || 0) / 1);
      case 'ten_wins': return Math.min(1, (stats.won || 0) / 10);
      case 'twenty_five_wins': return Math.min(1, (stats.won || 0) / 25);
      case 'foundation_builder': return Math.min(1, (stats.won || 0) / 50);
      case 'grandmaster': return Math.min(1, (stats.won || 0) / 100);
      case 'century': return Math.min(1, (stats.played || 0) / 100);
      case 'streak_3': return Math.min(1, (stats.dailyStreak || 0) / 3);
      case 'streak_7': return Math.min(1, (stats.dailyStreak || 0) / 7);
      case 'streak_14': return Math.min(1, (stats.dailyStreak || 0) / 14);
      case 'streak_30': return Math.min(1, (stats.dailyStreak || 0) / 30);
      case 'daily_devotee': return Math.min(1, (stats.dailyChallengesCompleted || 0) / 30);
      case 'card_shark': return Math.min(1, (stats.longestWinStreak || 0) / 5);
      case 'flawless_streak': return Math.min(1, (stats.longestWinStreak || 0) / 10);
      case 'collector': return Math.min(1, (stats.themesUnlocked || 0) / 5);
      case 'marathon': return Math.min(1, (stats.gamesPlayedToday || 0) / 10);
      default: return 0;
    }
  }

  /**
   * Get achievements grouped by category.
   * @param {object} stats
   * @returns {Object<string, Array>}
   */
  getByCategory(stats) {
    const progress = this.getProgress(stats);
    const grouped = {};
    for (const cat of Object.values(ACHIEVEMENT_CATEGORIES)) {
      grouped[cat] = progress.filter(a => a.category === cat);
    }
    return grouped;
  }

  /**
   * Get total completion percentage.
   * @returns {number} 0-1
   */
  getCompletionRate() {
    const total = getAllAchievementIds().length;
    return total > 0 ? this.unlocked.length / total : 0;
  }

  /**
   * Load state from saved data.
   * @param {object} data
   */
  loadState(data) {
    if (!data) return;
    this.unlocked = Array.isArray(data.unlocked) ? [...data.unlocked] : [];
    this._unlockTimes = data.unlockTimes || {};
  }

  /**
   * Get saveable state.
   * @returns {object}
   */
  getState() {
    return {
      unlocked: [...this.unlocked],
      unlockTimes: { ...this._unlockTimes }
    };
  }
}
