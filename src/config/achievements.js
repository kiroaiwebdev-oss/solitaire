/**
 * Achievement definitions.
 * Each achievement has an id, name, description, icon (unicode), and condition checker.
 */

export const ACHIEVEMENT_DEFS = {
  first_win: {
    id: 'first_win',
    name: 'First Win',
    description: 'Win your first game.',
    icon: '\u2605', // star
    check: (stats) => stats.won >= 1
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Win a game in under 3 minutes.',
    icon: '\u26A1', // lightning
    check: (stats) => stats.bestTime !== null && stats.bestTime < 180
  },
  streak_master: {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Achieve a 7-day daily challenge streak.',
    icon: '\uD83D\uDD25', // fire
    check: (stats) => (stats.dailyStreak || 0) >= 7
  },
  perfect_game: {
    id: 'perfect_game',
    name: 'Perfect Game',
    description: 'Win a game without using undo.',
    icon: '\uD83C\uDFC6', // trophy
    check: (stats) => stats.perfectWins >= 1
  },
  century: {
    id: 'century',
    name: 'Century',
    description: 'Play 100 games.',
    icon: '\uD83C\uDFAF', // target
    check: (stats) => stats.played >= 100
  },
  foundation_builder: {
    id: 'foundation_builder',
    name: 'Foundation Builder',
    description: 'Win 50 games.',
    icon: '\uD83C\uDFD7', // building
    check: (stats) => stats.won >= 50
  },
  daily_devotee: {
    id: 'daily_devotee',
    name: 'Daily Devotee',
    description: 'Complete 30 daily challenges.',
    icon: '\uD83D\uDCC5', // calendar
    check: (stats) => (stats.dailyChallengesCompleted || 0) >= 30
  },
  card_shark: {
    id: 'card_shark',
    name: 'Card Shark',
    description: 'Win 5 games in a row.',
    icon: '\uD83E\uDD88', // shark
    check: (stats) => (stats.longestWinStreak || 0) >= 5
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Win a game with a new fewest-moves record.',
    icon: '\u2728', // sparkles
    check: (stats) => stats.minimalistAchieved === true
  },
  hard_mode_hero: {
    id: 'hard_mode_hero',
    name: 'Hard Mode Hero',
    description: 'Win a game on Hard difficulty.',
    icon: '\uD83D\uDCAA', // muscle
    check: (stats) => stats.hardModeWins >= 1
  }
};

/**
 * Get all achievement IDs.
 * @returns {string[]}
 */
export function getAllAchievementIds() {
  return Object.keys(ACHIEVEMENT_DEFS);
}

/**
 * Get achievement definition by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getAchievementDef(id) {
  return ACHIEVEMENT_DEFS[id] || null;
}
