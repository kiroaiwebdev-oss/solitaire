/**
 * CrazyGames platform adapter (SDK v3).
 * SDK: https://sdk.crazygames.com/crazygames-sdk-v3.js
 *   global: window.CrazyGames ; methods under window.CrazyGames.SDK
 *
 * v3 integration:
 *   - SDK.init()                                   -> Promise
 *   - SDK.game.sdkGameLoadingStart()/sdkGameLoadingFinished()
 *   - SDK.game.gameplayStart()/gameplayStop()
 *   - SDK.game.happytime()
 *   - SDK.ad.requestAd('midgame'|'rewarded', { adStarted, adFinished, adError })
 *   - SDK.ad.hasAdblock (async) for adblock awareness
 *
 * Ads NEVER interrupt active gameplay (only requested at natural breaks by the
 * app); audio is muted during an ad and restored after. Rewarded grants ONLY
 * on adFinished, never on adError. Every SDK call is feature-detected and
 * adblock/missing-SDK safe.
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal, safe, fallbackAdOverlay } from './sdkUtil.js';

export class CrazyGamesAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'crazygames';
    this.sdk = null;
    this._muted = false;
    this._adblocked = false;
    this._loadingStarted = false;
    this._loadingFinished = false;
  }

  async init() {
    try {
      const cg = await waitForGlobal('CrazyGames', 8000);
      // v3 exposes the API under window.CrazyGames.SDK.
      this.sdk = cg.SDK || cg.sdk || cg;
      if (this.sdk && typeof this.sdk.init === 'function') {
        await this.sdk.init();
      }
      await this._detectAdblock();
      // Begin the loading phase as early as possible.
      this.loadingStart();
    } catch (e) {
      console.warn('[CrazyGames] SDK not available, using safe fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] CrazyGames mode');
  }

  async _detectAdblock() {
    try {
      if (this.sdk && this.sdk.ad && typeof this.sdk.ad.hasAdblock === 'function') {
        // v3 hasAdblock() returns a Promise<boolean>; await it (do NOT read sync).
        this._adblocked = (await this.sdk.ad.hasAdblock()) === true;
      }
    } catch (e) {
      // Unknown -> assume not blocked; ad calls are individually guarded anyway.
    }
  }

  loadingStart() {
    if (this._loadingStarted) return;
    this._loadingStarted = true;
    safe(() => this.sdk && this.sdk.game && this.sdk.game.sdkGameLoadingStart && this.sdk.game.sdkGameLoadingStart());
  }

  loadingFinished() {
    if (this._loadingFinished) return;
    this._loadingFinished = true;
    safe(() => this.sdk && this.sdk.game && this.sdk.game.sdkGameLoadingFinished && this.sdk.game.sdkGameLoadingFinished());
  }

  async showBanner() {
    // CrazyGames manages banner containers internally.
  }

  /** Midgame (interstitial) ad. Only call at a natural break, never mid-play. */
  async showInterstitial() {
    if (this._adblocked || !this.sdk || !this.sdk.ad || typeof this.sdk.ad.requestAd !== 'function') {
      await fallbackAdOverlay(3);
      return true;
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; this._muted = false; resolve(v); };
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => { this._muted = true; },
          adFinished: () => done(true),
          adError: () => done(true)
        });
      } catch (e) {
        done(true);
      }
      setTimeout(() => done(true), 30000);
    });
  }

  /** Rewarded ad. Resolves true ONLY on adFinished; adError/adblock -> false. */
  async showRewarded() {
    if (this._adblocked || !this.sdk || !this.sdk.ad || typeof this.sdk.ad.requestAd !== 'function') {
      return false; // no ad available -> no reward, but never soft-lock
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; this._muted = false; resolve(v); };
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => { this._muted = true; },
          adFinished: () => done(true),
          adError: () => done(false)
        });
      } catch (e) {
        done(false);
      }
      setTimeout(() => done(false), 60000);
    });
  }

  // Natural-break ad model.
  async commercialBreak() { return this.showInterstitial(); }
  async rewardedBreak() { return this.showRewarded(); }

  hideBanner() {}

  gameStart() { this.loadingFinished(); }

  gameOver(score) {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStop && this.sdk.game.gameplayStop());
  }

  happyMoment() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.happytime && this.sdk.game.happytime());
  }

  gameplayStart() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStart && this.sdk.game.gameplayStart());
  }

  gameplayStop() {
    safe(() => this.sdk && this.sdk.game && this.sdk.game.gameplayStop && this.sdk.game.gameplayStop());
  }

  shouldMuteAudio() { return this._muted; }
  isAdblocked() { return this._adblocked; }
  muteAudio() { this._muted = true; }
  unmuteAudio() { this._muted = false; }

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
