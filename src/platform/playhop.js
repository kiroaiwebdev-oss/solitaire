/**
 * PlayHop / Playgama platform adapter.
 * SDK: https://cdn.playgama.com/sdk/bridge.js
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal, safe, fallbackAdOverlay } from './sdkUtil.js';

export class PlayHopAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'playhop';
    this._muted = false;
    this._adblocked = false;
    this._bridge = null;
  }

  async init() {
    try {
      // Try PlgBridge first, then Playgama
      let bridge = null;
      try {
        bridge = await waitForGlobal('PlgBridge', 5000);
      } catch (e) {
        bridge = await waitForGlobal('Playgama', 3000);
      }
      this._bridge = bridge;
    } catch (e) {
      console.warn('[PlayHop] SDK not available, using fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] PlayHop/Playgama mode');
  }

  async showBanner() {}

  async showInterstitial() {
    if (this._adblocked || !this._bridge) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        const adApi = this._bridge.advertisement || this._bridge.ads;
        if (adApi && adApi.showInterstitial) {
          adApi.showInterstitial({
            onStart: () => { this._muted = true; },
            onClose: () => { this._muted = false; resolve(true); },
            onError: () => { this._muted = false; resolve(true); }
          });
        } else {
          this._muted = false;
          resolve(true);
        }
      } catch (e) {
        this._muted = false;
        resolve(true);
      }
    });
  }

  async showRewarded() {
    if (this._adblocked || !this._bridge) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      try {
        this._muted = true;
        const adApi = this._bridge.advertisement || this._bridge.ads;
        if (adApi && adApi.showRewarded) {
          adApi.showRewarded({
            onStart: () => { this._muted = true; },
            onRewarded: () => { this._muted = false; resolve(true); },
            onClose: () => { this._muted = false; resolve(false); },
            onError: () => { this._muted = false; resolve(false); }
          });
        } else {
          this._muted = false;
          resolve(false);
        }
      } catch (e) {
        this._muted = false;
        resolve(false);
      }
    });
  }

  hideBanner() {}

  gameStart() {
    safe(() => {
      if (this._bridge && this._bridge.game) {
        this._bridge.game.gameStart();
      }
    });
  }

  gameOver(score) {
    safe(() => {
      if (this._bridge && this._bridge.game) {
        this._bridge.game.gameOver(score);
      }
    });
  }

  happyMoment() {}

  gameplayStart() {
    safe(() => {
      if (this._bridge && this._bridge.game) {
        this._bridge.game.gameStart();
      }
    });
  }

  gameplayStop() {
    safe(() => {
      if (this._bridge && this._bridge.game) {
        this._bridge.game.gameOver();
      }
    });
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
