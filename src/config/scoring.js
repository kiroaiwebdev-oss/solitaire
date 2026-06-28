/**
 * Scoring constants and mode definitions.
 * Supports Standard, Vegas, and None (practice) scoring modes.
 */

export const SCORING = {
  // Standard mode point values
  WASTE_TO_TABLEAU: 5,
  WASTE_TO_FOUNDATION: 10,
  TABLEAU_TO_FOUNDATION: 10,
  REVEAL_CARD: 5,
  FOUNDATION_TO_TABLEAU: -15,
  RECYCLE_STOCK: -20,
  UNDO_PENALTY: -20,

  // Time bonus (Standard mode only)
  TIME_BONUS_THRESHOLD: 300, // seconds under which bonus applies
  TIME_BONUS_MULTIPLIER: 2,

  // Hard mode time limit
  HARD_MODE_TIME: 600, // 10 minutes in seconds

  // Vegas mode
  VEGAS_START: -52,
  VEGAS_FOUNDATION_BONUS: 5,
  VEGAS_RECYCLE_LIMIT: 3, // max recycles in Vegas draw-3
  VEGAS_NO_RECYCLE_LIMIT_DRAW1: true // unlimited in draw-1 Vegas
};

/**
 * Calculate the final score including time bonus.
 * @param {number} baseScore - score accumulated during game
 * @param {number} timeSeconds - total time taken
 * @param {string} mode - 'standard', 'vegas', or 'none'
 * @returns {number}
 */
export function calculateFinalScore(baseScore, timeSeconds, mode = 'standard') {
  if (mode === 'none') return 0;
  if (mode === 'vegas') return baseScore;

  // Standard mode time bonus
  let bonus = 0;
  if (timeSeconds > 0 && timeSeconds < SCORING.TIME_BONUS_THRESHOLD) {
    bonus = Math.floor((SCORING.TIME_BONUS_THRESHOLD - timeSeconds) * SCORING.TIME_BONUS_MULTIPLIER);
  }
  return baseScore + bonus;
}

/**
 * Get scoring description for display.
 * @param {string} mode
 * @returns {string}
 */
export function getScoringDescription(mode) {
  switch (mode) {
    case 'standard':
      return 'Earn points for moves. Bonus for speed.';
    case 'vegas':
      return 'Start at -$52. Earn $5 per foundation card.';
    case 'none':
      return 'Practice mode. No score tracking.';
    default:
      return '';
  }
}
