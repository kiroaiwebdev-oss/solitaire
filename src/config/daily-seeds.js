/**
 * Daily challenge seed generation.
 * Seeds are deterministic based on the date.
 */

/**
 * Generate a seed for a given date.
 * @param {Date} [date] - defaults to today
 * @returns {number}
 */
export function getDailySeed(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  // Simple hash combining year, month, day
  return ((year * 31 + month) * 31 + day) * 2654435761 >>> 0;
}

/**
 * Get today's seed.
 * @returns {number}
 */
export function getTodaySeed() {
  return getDailySeed(new Date());
}
