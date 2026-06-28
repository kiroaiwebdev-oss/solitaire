/**
 * Achievement definitions: 25+ achievements across categories with
 * progress tracking, rarity tiers, and condition checkers.
 */

export const ACHIEVEMENT_CATEGORIES = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
  SPECIAL: 'Special'
};

export const ACHIEVEMENT_RARITY = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary'
};

export const ACHIEVEMENT_DEFS = {
  first_win: {
    id: 'first_win',
    name: 'First Win',
    description: 'Win your first game.',
    icon: '\u2605',
    category: ACHIEVEMENT_CATEGORIES.BEGINNER,
    rarity: ACHIEVEMENT_RARITY.COMMON,
    check: (stats) => stats.won >= 1
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Win a game in under 3 minutes.',
    icon: '\u26A1',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.bestTime !== null && stats.bestTime < 180
  },
  streak_3: {
    id: 'streak_3',
    name: 'Getting Warm',
    description: 'Achieve a 3-day daily challenge streak.',
    icon: '\uD83D\uDD25',
    category: ACHIEVEMENT_CATEGORIES.BEGINNER,
    rarity: ACHIEVEMENT_RARITY.COMMON,
    check: (stats) => (stats.dailyStreak || 0) >= 3
  },
  streak_7: {
    id: 'streak_7',
    name: 'Streak Master',
    description: 'Achieve a 7-day daily challenge streak.',
    icon: '\uD83D\uDD25',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => (stats.dailyStreak || 0) >= 7
  },
  streak_14: {
    id: 'streak_14',
    name: 'Fortnight Champion',
    description: 'Achieve a 14-day daily challenge streak.',
    icon: '\uD83D\uDD25',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => (stats.dailyStreak || 0) >= 14
  },
  streak_30: {
    id: 'streak_30',
    name: 'Monthly Devotion',
    description: 'Achieve a 30-day daily challenge streak.',
    icon: '\uD83D\uDD25',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => (stats.dailyStreak || 0) >= 30
  },
  perfect_game: {
    id: 'perfect_game',
    name: 'Perfect Game',
    description: 'Win a game without using undo.',
    icon: '\uD83C\uDFC6',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.perfectWins >= 1
  },
  century: {
    id: 'century',
    name: 'Century',
    description: 'Play 100 games.',
    icon: '\uD83C\uDFAF',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => stats.played >= 100
  },
  foundation_builder: {
    id: 'foundation_builder',
    name: 'Foundation Builder',
    description: 'Win 50 games.',
    icon: '\uD83C\uDFD7\uFE0F',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => stats.won >= 50
  },
  daily_devotee: {
    id: 'daily_devotee',
    name: 'Daily Devotee',
    description: 'Complete 30 daily challenges.',
    icon: '\uD83D\uDCC5',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => (stats.dailyChallengesCompleted || 0) >= 30
  },
  card_shark: {
    id: 'card_shark',
    name: 'Card Shark',
    description: 'Win 5 games in a row.',
    icon: '\uD83E\uDD88',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => (stats.longestWinStreak || 0) >= 5
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Win a game with a new fewest-moves record.',
    icon: '\u2728',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.minimalistAchieved === true
  },
  hard_mode_hero: {
    id: 'hard_mode_hero',
    name: 'Hard Mode Hero',
    description: 'Win a game on Hard difficulty.',
    icon: '\uD83D\uDCAA',
    category: ACHIEVEMENT_CATEGORIES.ADVANCED,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => stats.hardModeWins >= 1
  },
  all_suits: {
    id: 'all_suits',
    name: 'All Suits',
    description: 'Complete each suit to the foundation at least once.',
    icon: '\u2660',
    category: ACHIEVEMENT_CATEGORIES.BEGINNER,
    rarity: ACHIEVEMENT_RARITY.COMMON,
    check: (stats) => stats.suitsCompleted >= 4
  },
  marathon: {
    id: 'marathon',
    name: 'Marathon',
    description: 'Play 10 games in a single day.',
    icon: '\uD83C\uDFC3',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => (stats.gamesPlayedToday || 0) >= 10
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Play a game after midnight.',
    icon: '\uD83E\uDD89',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.playedAfterMidnight === true
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Play a game before 7 AM.',
    icon: '\uD83D\uDC26',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.playedBefore7am === true
  },
  collector: {
    id: 'collector',
    name: 'Collector',
    description: 'Unlock 5 card back themes.',
    icon: '\uD83C\uDFA8',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => (stats.themesUnlocked || 0) >= 5
  },
  speed_run: {
    id: 'speed_run',
    name: 'Speed Run',
    description: 'Win a game in under 2 minutes.',
    icon: '\u23F1\uFE0F',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => stats.bestTime !== null && stats.bestTime < 120
  },
  grandmaster: {
    id: 'grandmaster',
    name: 'Grandmaster',
    description: 'Win 100 games.',
    icon: '\uD83C\uDFAD',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => stats.won >= 100
  },
  no_stock: {
    id: 'no_stock',
    name: 'No Stock Needed',
    description: 'Win a game without drawing from the stock.',
    icon: '\uD83D\uDE4C',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => stats.noStockWins >= 1
  },
  comeback: {
    id: 'comeback',
    name: 'Comeback King',
    description: 'Win after having 0 foundation cards for 5+ minutes.',
    icon: '\uD83D\uDC51',
    category: ACHIEVEMENT_CATEGORIES.SPECIAL,
    rarity: ACHIEVEMENT_RARITY.EPIC,
    check: (stats) => stats.comebackWins >= 1
  },
  flawless_streak: {
    id: 'flawless_streak',
    name: 'Flawless Streak',
    description: 'Win 10 games in a row.',
    icon: '\uD83C\uDF1F',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => (stats.longestWinStreak || 0) >= 10
  },
  ten_wins: {
    id: 'ten_wins',
    name: 'Getting Started',
    description: 'Win 10 games.',
    icon: '\uD83C\uDF1E',
    category: ACHIEVEMENT_CATEGORIES.BEGINNER,
    rarity: ACHIEVEMENT_RARITY.COMMON,
    check: (stats) => stats.won >= 10
  },
  twenty_five_wins: {
    id: 'twenty_five_wins',
    name: 'Silver Player',
    description: 'Win 25 games.',
    icon: '\uD83E\uDD48',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => stats.won >= 25
  },
  expert_mode_win: {
    id: 'expert_mode_win',
    name: 'Expert Tactician',
    description: 'Win a game on Expert difficulty.',
    icon: '\uD83E\uDDE0',
    category: ACHIEVEMENT_CATEGORIES.EXPERT,
    rarity: ACHIEVEMENT_RARITY.LEGENDARY,
    check: (stats) => stats.expertModeWins >= 1
  },
  high_score: {
    id: 'high_score',
    name: 'High Roller',
    description: 'Score over 1000 points in a single game.',
    icon: '\uD83D\uDCB0',
    category: ACHIEVEMENT_CATEGORIES.INTERMEDIATE,
    rarity: ACHIEVEMENT_RARITY.RARE,
    check: (stats) => (stats.highScore || 0) >= 1000
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

/**
 * Get achievements filtered by category.
 * @param {string} category
 * @returns {object[]}
 */
export function getAchievementsByCategory(category) {
  return Object.values(ACHIEVEMENT_DEFS).filter(a => a.category === category);
}

/**
 * Get achievements filtered by rarity.
 * @param {string} rarity
 * @returns {object[]}
 */
export function getAchievementsByRarity(rarity) {
  return Object.values(ACHIEVEMENT_DEFS).filter(a => a.rarity === rarity);
}

/**
 * Get the total number of achievements.
 * @returns {number}
 */
export function getAchievementCount() {
  return Object.keys(ACHIEVEMENT_DEFS).length;
}
