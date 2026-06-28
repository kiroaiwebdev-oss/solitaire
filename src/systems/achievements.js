/**
 * Achievement tracking system.
 * Checks conditions after each game and unlocks achievements.
 */

import { ACHIEVEMENT_DEFS, getAllAchievementIds } from '../config/achievements.js';

export class Achievements {
  constructor() {
    this.unlocked = [];
    this._pendingNotifications = [];
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
      }
    }

    return newlyUnlocked;
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
   * @returns {object|null} - { id, name, icon, description }
   */
  popNotification() {
    if (this._pendingNotifications.length === 0) return null;
    const id = this._pendingNotifications.shift();
    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return null;
    return { id: def.id, name: def.name, icon: def.icon, description: def.description };
  }

  /**
   * Check if there are pending notifications.
   * @returns {boolean}
   */
  hasNotifications() {
    return this._pendingNotifications.length > 0;
  }

  /**
   * Get progress info for all achievements.
   * @param {object} stats
   * @returns {Array<{ id, name, icon, description, unlocked, progress }>}
   */
  getProgress(stats) {
    const allIds = getAllAchievementIds();
    return allIds.map(id => {
      const def = ACHIEVEMENT_DEFS[id];
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        unlocked: this.unlocked.includes(id),
        met: def.check(stats)
      };
    });
  }

  /**
   * Load state from saved data.
   * @param {object} data
   */
  loadState(data) {
    if (!data) return;
    this.unlocked = Array.isArray(data.unlocked) ? [...data.unlocked] : [];
  }

  /**
   * Get saveable state.
   * @returns {object}
   */
  getState() {
    return {
      unlocked: [...this.unlocked]
    };
  }
}
