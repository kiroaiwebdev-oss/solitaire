/**
 * GameDistribution platform adapter.
 * SDK: https://html5.api.gamedistribution.com/main.min.js
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal, safe, audioMuteHelper, fallbackAdOverlay } from './sdkUtil.js';

export class GameDistributionAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'gamedistribution';
    this._muted = false;
    this._adblocked = false;
    this._prerollShown = false;
  }

  async init() {
    try {
      await waitForGlobal('gdsdk', 8000);
      // Show preroll ad on init
      if (!this._prerollShown) {
        this._prerollShown = true;
        safe(() => window.gdsdk.preloadAd && window.gdsdk.preloadAd('interstitial'));
      }
    } catch (e) {
      console.warn('[GameDistribution] SDK not available, using fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] GameDistribution mode');
  }

  async showBanner() {
    // GameDistribution handles banners via container div
  }

  async showInterstitial() {
    if (this._adblocked || !window.gdsdk) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        window.gdsdk.showAd('interstitial').then((result) => {
          this._muted = false;
          resolve(true);
        }).catch(() => {
          this._muted = false;
          resolve(true);
        });
      } catch (e) {
        this._muted = false;
        resolve(true);
      }
    });
  }

  async showRewarded() {
    if (this._adblocked || !window.gdsdk) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        window.gdsdk.showAd('rewarded').then((result) => {
          this._muted = false;
          resolve(true);
        }).catch(() => {
          this._muted = false;
          resolve(false);
        });
      } catch (e) {
        this._muted = false;
        resolve(false);
      }
    });
  }

  hideBanner() {}

  gameStart() {}
  gameOver(score) {}

  happyMoment() {}

  gameplayStart() {
    // Notify SDK that gameplay is active
  }

  gameplayStop() {
    // Notify SDK that gameplay stopped
  }

  shouldMuteAudio() {
    return this._muted;
  }

  isAdblocked() {
    return this._adblocked;
  }

  muteAudio() {
    this._muted = true;
  }

  unmuteAudio() {
    this._muted = false;
  }

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
