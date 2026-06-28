/**
 * Daily challenge seed generation.
 * Seeds are deterministic based on the date so all players
 * get the same game each day.
 */

/**
 * Generate a seed for a given date.
 * Uses a hash combining year, month, day with a large prime for good distribution.
 * @param {Date} [date] - defaults to today
 * @returns {number}
 */
export function getDailySeed(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // Knuth multiplicative hash for good distribution
  return ((year * 31 + month) * 31 + day) * 2654435761 >>> 0;
}

/**
 * Get today's seed.
 * @returns {number}
 */
export function getTodaySeed() {
  return getDailySeed(new Date());
}

/**
 * Get seed for a specific date string (YYYY-MM-DD).
 * @param {string} dateStr
 * @returns {number}
 */
export function getSeedForDateString(dateStr) {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return getDailySeed(date);
}

/**
 * Get the date key string for a given date.
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD
 */
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
