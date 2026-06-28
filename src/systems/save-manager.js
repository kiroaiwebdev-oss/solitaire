/**
 * Save/load manager with versioned storage, game history,
 * replay data, and data migration support.
 * Uses platform adapter when available, localStorage as fallback.
 */

const SAVE_PREFIX = 'solitaire_';
const SAVE_VERSION = 2; // Increment when save format changes

export const SAVE_KEYS = {
  SETTINGS: SAVE_PREFIX + 'settings',
  STATS: SAVE_PREFIX + 'stats',
  PROGRESSION: SAVE_PREFIX + 'progression',
  ACHIEVEMENTS: SAVE_PREFIX + 'achievements',
  DAILY: SAVE_PREFIX + 'daily',
  GAME_STATE: SAVE_PREFIX + 'game_state',
  GAME_HISTORY: SAVE_PREFIX + 'game_history',
  REPLAY_DATA: SAVE_PREFIX + 'replay_data',
  COACH_SEEN: SAVE_PREFIX + 'coach_seen',
  VERSION: SAVE_PREFIX + 'version'
};

export class SaveManager {
  constructor(adapter) {
    this.adapter = adapter;
    this.version = SAVE_VERSION;
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
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      // Storage might be unavailable (quota exceeded, private mode, etc.)
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
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      }
      return null;
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
      if (typeof localStorage !== 'undefined') {
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
    this.save(SAVE_KEYS.VERSION, { version: this.version });
  }

  /**
   * Load all meta state.
   * @returns {object} - { stats, progression, achievements, daily }
   */
  loadAll() {
    // Check version and migrate if needed
    this._checkAndMigrate();

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

  // --- Game History ---

  /**
   * Save a completed game to history.
   * @param {object} gameResult - { won, score, moves, time, difficulty, date }
   */
  saveGameToHistory(gameResult) {
    const history = this.loadGameHistory();
    history.push({
      ...gameResult,
      date: gameResult.date || new Date().toISOString()
    });
    // Keep last 100 games
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.save(SAVE_KEYS.GAME_HISTORY, history);
  }

  /**
   * Load game history.
   * @returns {object[]}
   */
  loadGameHistory() {
    return this.load(SAVE_KEYS.GAME_HISTORY) || [];
  }

  // --- Replay Data ---

  /**
   * Save replay data for a game.
   * @param {string} id - unique game identifier
   * @param {object} replayData
   */
  saveReplayData(id, replayData) {
    const replays = this.load(SAVE_KEYS.REPLAY_DATA) || {};
    replays[id] = replayData;
    // Keep last 10 replays
    const keys = Object.keys(replays);
    if (keys.length > 10) {
      delete replays[keys[0]];
    }
    this.save(SAVE_KEYS.REPLAY_DATA, replays);
  }

  /**
   * Load replay data.
   * @param {string} id
   * @returns {object|null}
   */
  loadReplayData(id) {
    const replays = this.load(SAVE_KEYS.REPLAY_DATA) || {};
    return replays[id] || null;
  }

  // --- Settings ---

  /**
   * Save settings.
   * @param {object} settings
   */
  saveSettings(settings) {
    this.save(SAVE_KEYS.SETTINGS, {
      ...settings,
      version: this.version
    });
  }

  /**
   * Load settings.
   * @returns {object|null}
   */
  loadSettings() {
    return this.load(SAVE_KEYS.SETTINGS);
  }

  // --- Migration ---

  /**
   * Check save version and migrate data if needed.
   */
  _checkAndMigrate() {
    const versionData = this.load(SAVE_KEYS.VERSION);
    const savedVersion = versionData ? versionData.version : 1;

    if (savedVersion < this.version) {
      this._migrate(savedVersion, this.version);
      this.save(SAVE_KEYS.VERSION, { version: this.version });
    }
  }

  /**
   * Run migrations between versions.
   * @param {number} from
   * @param {number} to
   */
  _migrate(from, to) {
    // Version 1 -> 2: Add monthly tracking to daily, add game history
    if (from < 2) {
      const daily = this.load(SAVE_KEYS.DAILY);
      if (daily && !daily.completedDates) {
        daily.completedDates = [];
        daily.monthlyCompleted = {};
        this.save(SAVE_KEYS.DAILY, daily);
      }
    }
  }

  /**
   * Clear all saved data (factory reset).
   */
  clearAll() {
    for (const key of Object.values(SAVE_KEYS)) {
      this.delete(key);
    }
  }
}
