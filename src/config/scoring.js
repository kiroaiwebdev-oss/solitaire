/**
 * Scoring constants for the game.
 */

export const SCORING = {
  WASTE_TO_TABLEAU: 5,
  WASTE_TO_FOUNDATION: 10,
  TABLEAU_TO_FOUNDATION: 10,
  REVEAL_CARD: 5,
  FOUNDATION_TO_TABLEAU: -15,
  RECYCLE_STOCK: -20,
  UNDO_PENALTY: -20,
  TIME_BONUS_THRESHOLD: 300, // seconds under which bonus applies
  TIME_BONUS_MULTIPLIER: 2,
  HARD_MODE_TIME: 600 // 10 minutes in seconds
};
