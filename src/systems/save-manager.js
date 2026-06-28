/**
 * Save/load manager stub.
 * Full implementation in a later feature.
 */

export class SaveManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      // Storage might be unavailable
    }
  }

  load(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  delete(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  }
}
