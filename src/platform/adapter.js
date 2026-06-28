/**
 * Base PlatformAdapter interface.
 */

export class PlatformAdapter {
  constructor() {
    this.name = 'base';
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
  }

  // Ad methods (stubs)
  async showBanner() {}
  async showInterstitial() { return true; }
  async showRewarded() { return false; }
  hideBanner() {}

  // Game events
  gameStart() {}
  gameOver(score) {}
  happyMoment() {}
  gameplayStart() {}
  gameplayStop() {}

  // Audio control
  shouldMuteAudio() { return false; }

  // Save/load
  save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }
  load(key) {
    try {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch(e) { return null; }
  }

  // Sharing
  async share(data) {}

  // Leaderboard
  async submitScore(score) {}
}
