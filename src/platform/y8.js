/**
 * Y8 platform adapter.
 * SDK: https://cdn.y8.com/api/sdk.js
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal, safe, fallbackAdOverlay } from './sdkUtil.js';

export class Y8Adapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'y8';
    this._muted = false;
    this._adblocked = false;
    this._idReady = false;
  }

  async init() {
    try {
      const ID = await waitForGlobal('ID', 8000);
      if (ID && ID.init) {
        await new Promise((resolve, reject) => {
          try {
            ID.init({
              appId: window.__Y8_APP_ID__ || 'default'
            });
            this._idReady = true;
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }
    } catch (e) {
      console.warn('[Y8] SDK not available, using fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] Y8 mode');
  }

  async showBanner() {}

  async showInterstitial() {
    if (this._adblocked || !window.ID || !window.ID.GameAPI) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        window.ID.GameAPI.Ads.display(() => {
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
    if (this._adblocked || !window.ID || !window.ID.GameAPI) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        window.ID.GameAPI.Ads.display(() => {
          this._muted = false;
          resolve(true);
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
  gameplayStart() {}
  gameplayStop() {}

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

  // Cloud save via Y8 or localStorage fallback
  save(key, data) {
    if (this._idReady && window.ID && window.ID.GameAPI && window.ID.GameAPI.Achievements) {
      safe(() => window.ID.GameAPI.Achievements.save({ key, data: JSON.stringify(data) }));
    } else {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    }
  }

  load(key) {
    if (this._idReady && window.ID && window.ID.GameAPI && window.ID.GameAPI.Achievements) {
      // Y8 cloud load is async, but our interface is sync - use localStorage as primary
    }
    try {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch (e) { return null; }
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
