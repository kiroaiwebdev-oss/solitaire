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

  // --- Loading handshake (wired generically from boot/loading screen) ---
  // loadingStart  : called once SDK/asset loading begins
  // loadingFinished: called once the menu is interactive (game finished loading)
  // firstFrameReady: called once the very first frame has rendered
  // gameReady     : called once the game is ready to accept input (after firstFrameReady)
  loadingStart() {}
  loadingFinished() {}
  firstFrameReady() {}
  gameReady() {}

  // --- Natural-break ads (Promise-based) ---
  // commercialBreak(): resolves when an (optional) ad finishes/skips; safe no-op
  //                    by default. Call only at natural breaks, never mid-play.
  // rewardedBreak() : resolves true ONLY when the player earned the reward.
  //                   Must resolve safely (false) on adblock/missing SDK.
  async commercialBreak() { return this.showInterstitial(); }
  async rewardedBreak() { return this.showRewarded(); }

  // Audio control
  shouldMuteAudio() { return false; }
  muteAudio() {}
  unmuteAudio() {}

  // Platform audio gate. When a platform owns the audio state (e.g. YouTube
  // Playables) it returns false to force-mute regardless of the in-game toggle.
  isAudioEnabled() { return true; }

  // Bind platform lifecycle callbacks (pause/resume/audio-change). Adapters
  // that expose host events (YouTube Playables, etc.) wire them to `handlers`.
  bindLifecycle(handlers) { this._lifecycle = handlers || {}; }

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
