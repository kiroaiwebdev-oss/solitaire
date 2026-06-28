/**
 * Base PlatformAdapter interface.
 * All platform adapters extend this class and override methods as needed.
 */

export class PlatformAdapter {
  constructor() {
    this.name = 'base';
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
  }

  // Ad methods
  async showBanner() {}
  async showInterstitial() { return true; }
  async showRewarded() { return false; }
  hideBanner() {}

  // Aliased ad methods (alternate interface)
  showBannerAd() { return this.showBanner(); }
  showInterstitialAd() { return this.showInterstitial(); }
  async showRewardedAd(callback) {
    const result = await this.showRewarded();
    if (callback) callback(result);
    return result;
  }

  // Game lifecycle events
  gameStart() {}
  gameOver(score) {}
  happyMoment() {}
  happyTime() { this.happyMoment(); }
  gameplayStart() {}
  gameplayStop() {}

  // Audio control
  shouldMuteAudio() { return false; }
  muteAudio() {}
  unmuteAudio() {}

  // Adblock detection
  isAdblocked() { return false; }

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
  saveData(key, data) { this.save(key, data); }
  loadData(key) { return this.load(key); }

  // Sharing
  async share(data) {}

  // Leaderboard
  async submitScore(score) {}
}
