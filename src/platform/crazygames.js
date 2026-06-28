/**
 * CrazyGames platform adapter.
 * SDK: https://sdk.crazygames.com/crazygames-sdk-v3.js
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal, safe, audioMuteHelper, fallbackAdOverlay } from './sdkUtil.js';

export class CrazyGamesAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'crazygames';
    this.sdk = null;
    this._muted = false;
    this._adblocked = false;
  }

  async init() {
    try {
      const cg = await waitForGlobal('CrazyGames', 8000);
      this.sdk = cg.CrazyGames || cg;
      if (this.sdk.init) {
        await this.sdk.init();
      }
      // Detect adblock
      this._detectAdblock();
    } catch (e) {
      console.warn('[CrazyGames] SDK not available, using fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] CrazyGames mode');
  }

  _detectAdblock() {
    // CrazyGames SDK exposes adblock detection
    if (this.sdk && this.sdk.ad && this.sdk.ad.hasAdblock) {
      this._adblocked = true;
    }
  }

  async showBanner() {
    // CrazyGames handles banners internally
  }

  async showInterstitial() {
    if (this._adblocked || !this.sdk) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      safe(() => {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => { this._muted = true; },
          adFinished: () => { this._muted = false; resolve(true); },
          adError: () => { this._muted = false; resolve(true); }
        });
      });
      // Fallback timeout in case callbacks never fire
      setTimeout(() => { this._muted = false; resolve(true); }, 30000);
    });
  }

  async showRewarded() {
    if (this._adblocked || !this.sdk) {
      await fallbackAdOverlay(5);
      return true;
    }
    return new Promise((resolve) => {
      safe(() => {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => { this._muted = true; },
          adFinished: () => { this._muted = false; resolve(true); },
          adError: () => { this._muted = false; resolve(false); }
        });
      });
      setTimeout(() => { this._muted = false; resolve(false); }, 60000);
    });
  }

  hideBanner() {}

  gameStart() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.sdkGameLoadingStop());
  }

  gameOver(score) {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStop());
  }

  happyMoment() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.happyTime());
  }

  gameplayStart() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStart());
  }

  gameplayStop() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStop());
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
