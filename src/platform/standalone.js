/**
 * Standalone adapter for direct hosting / itch.io / local development.
 * No SDK dependency - all ad methods are no-ops or show fallback overlay.
 */

import { PlatformAdapter } from './adapter.js';
import { fallbackAdOverlay } from './sdkUtil.js';

export class StandaloneAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'standalone';
    this._muted = false;
  }

  async init() {
    this.initialized = true;
    console.log('[Platform] Standalone mode');
  }

  async showBanner() {}
  async showInterstitial() { return true; }
  async showRewarded() { return false; }
  hideBanner() {}

  // No ad network when self-hosted: a commercial break is an instant no-op,
  // and the optional rewarded reward is granted directly (nothing to watch)
  // so the reward control still has a real, visible effect off-portal.
  async commercialBreak() { return true; }
  async rewardedBreak() { return true; }

  gameStart() {}
  gameOver(score) {}
  happyMoment() {}
  gameplayStart() {}
  gameplayStop() {}

  shouldMuteAudio() { return this._muted; }
  isAdblocked() { return true; }

  muteAudio() { this._muted = true; }
  unmuteAudio() { this._muted = false; }

  // Save/load uses localStorage directly
  save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
  }

  load(key) {
    try {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch (e) { return null; }
  }

  // Aliased interface methods
  showBannerAd() { return this.showBanner(); }
  showInterstitialAd() { return this.showInterstitial(); }
  async showRewardedAd(callback) {
    const result = await this.showRewarded();
    if (callback) callback(result);
    return result;
  }

  saveData(key, data) { this.save(key, data); }
  loadData(key) { return this.load(key); }
  happyTime() { this.happyMoment(); }
}
