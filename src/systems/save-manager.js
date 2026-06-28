/**
 * Save/load manager.
 * Handles persistence of game state, statistics, achievements,
 * progression, settings, and daily challenge data.
 * Uses platform adapter when available, localStorage as fallback.
 */

const SAVE_PREFIX = 'solitaire_';

export const SAVE_KEYS = {
  SETTINGS: SAVE_PREFIX + 'settings',
  STATS: SAVE_PREFIX + 'stats',
  PROGRESSION: SAVE_PREFIX + 'progression',
  ACHIEVEMENTS: SAVE_PREFIX + 'achievements',
  DAILY: SAVE_PREFIX + 'daily',
  GAME_STATE: SAVE_PREFIX + 'game_state',
  COACH_SEEN: SAVE_PREFIX + 'coach_seen'
};

export class SaveManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Save data to storage.
   * @param {string} key
   * @param {*} data
   */
  save(key, data) {
    try {
      if (this.adapter && typeof this.adapter.save === 'function') {
        this.adapter.save(key, data);
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      // Storage might be unavailable
    }
  }

  /**
   * Load data from storage.
   * @param {string} key
   * @returns {*}
   */
  load(key) {
    try {
      if (this.adapter && typeof this.adapter.load === 'function') {
        return this.adapter.load(key);
      }
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Delete data from storage.
   * @param {string} key
   */
  delete(key) {
    try {
      if (this.adapter && typeof this.adapter.save === 'function') {
        // Most adapters use localStorage under the hood
        localStorage.removeItem(key);
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Save all meta state at once (statistics, progression, achievements, daily).
   * @param {object} state - { stats, progression, achievements, daily }
   */
  saveAll(state) {
    if (state.stats) this.save(SAVE_KEYS.STATS, state.stats);
    if (state.progression) this.save(SAVE_KEYS.PROGRESSION, state.progression);
    if (state.achievements) this.save(SAVE_KEYS.ACHIEVEMENTS, state.achievements);
    if (state.daily) this.save(SAVE_KEYS.DAILY, state.daily);
  }

  /**
   * Load all meta state.
   * @returns {object} - { stats, progression, achievements, daily }
   */
  loadAll() {
    return {
      stats: this.load(SAVE_KEYS.STATS),
      progression: this.load(SAVE_KEYS.PROGRESSION),
      achievements: this.load(SAVE_KEYS.ACHIEVEMENTS),
      daily: this.load(SAVE_KEYS.DAILY)
    };
  }

  /**
   * Save in-progress game state.
   * @param {object} gameState
   */
  saveGameState(gameState) {
    this.save(SAVE_KEYS.GAME_STATE, gameState);
  }

  /**
   * Load in-progress game state.
   * @returns {object|null}
   */
  loadGameState() {
    return this.load(SAVE_KEYS.GAME_STATE);
  }

  /**
   * Clear saved game state.
   */
  clearGameState() {
    this.delete(SAVE_KEYS.GAME_STATE);
  }

  /**
   * Check if a saved game exists.
   * @returns {boolean}
   */
  hasSavedGame() {
    return this.load(SAVE_KEYS.GAME_STATE) !== null;
  }
}
