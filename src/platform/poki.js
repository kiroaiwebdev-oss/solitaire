/**
 * Poki platform adapter.
 * SDK: https://game-cdn.poki.com/scripts/v2/poki-sdk.js  (global: PokiSDK)
 *
 * Integrates the official PokiSDK lifecycle:
 *   - PokiSDK.init()                       -> Promise (resolve even on adblock)
 *   - PokiSDK.setDebug(true)               -> only on local / non-production
 *   - PokiSDK.gameLoadingStart()/Finished()-> wrap the loading screen
 *   - PokiSDK.gameplayStart()/gameplayStop()
 *   - PokiSDK.commercialBreak()            -> Promise (resolve when ad done/skipped)
 *   - PokiSDK.rewardedBreak()              -> Promise<boolean> (true only if watched)
 *
 * Every call is feature-detected and adblock/missing-SDK safe: a blocked or
 * absent SDK never crashes or soft-locks the game.
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal } from './sdkUtil.js';

function isLocalHost() {
  try {
    const h = (window.location && window.location.hostname) || '';
    return h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local');
  } catch (e) {
    return false;
  }
}

export class PokiAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'poki';
    this.sdk = null;
    this._muted = false;
    this._adblocked = false;
    this._loadingStarted = false;
    this._loadingFinished = false;
  }

  async init() {
    try {
      this.sdk = await waitForGlobal('PokiSDK', 8000);
      // Debug only outside production (local dev) so portal QA logs stay clean.
      if (isLocalHost() && typeof this.sdk.setDebug === 'function') {
        try { this.sdk.setDebug(true); } catch (e) {}
      }
      if (typeof this.sdk.init === 'function') {
        // init() resolves even when ads are blocked; guard either way.
        await this.sdk.init().catch(() => { this._adblocked = true; });
      }
      // Begin the Poki loading phase as early as possible.
      this.loadingStart();
    } catch (e) {
      console.warn('[Poki] SDK not available, using safe fallbacks');
      this._adblocked = true;
    }
    this.initialized = true;
    console.log('[Platform] Poki mode');
  }

  loadingStart() {
    if (this._loadingStarted) return;
    this._loadingStarted = true;
    try {
      if (this.sdk && typeof this.sdk.gameLoadingStart === 'function') {
        this.sdk.gameLoadingStart();
      }
    } catch (e) {}
  }

  loadingFinished() {
    if (this._loadingFinished) return;
    this._loadingFinished = true;
    try {
      if (this.sdk && typeof this.sdk.gameLoadingFinished === 'function') {
        this.sdk.gameLoadingFinished();
      }
    } catch (e) {}
  }

  gameplayStart() {
    try {
      if (this.sdk && typeof this.sdk.gameplayStart === 'function') {
        this.sdk.gameplayStart();
      }
    } catch (e) {}
  }

  gameplayStop() {
    try {
      if (this.sdk && typeof this.sdk.gameplayStop === 'function') {
        this.sdk.gameplayStop();
      }
    } catch (e) {}
  }

  /**
   * Non-rewarded ad at a natural break. Mutes audio for the ad duration and
   * always resolves (even on adblock / error) so gameplay can resume.
   */
  async commercialBreak() {
    if (!this.sdk || typeof this.sdk.commercialBreak !== 'function') {
      return true; // nothing to show; safe to continue
    }
    this._muted = true;
    try {
      await this.sdk.commercialBreak();
    } catch (e) {
      // Adblock / network error: never soft-lock.
    } finally {
      this._muted = false;
    }
    return true;
  }

  /**
   * Optional rewarded ad. Resolves true ONLY when the player watched to
   * completion. Adblock/error/skip resolves false (no reward, no crash).
   */
  async rewardedBreak() {
    if (!this.sdk || typeof this.sdk.rewardedBreak !== 'function') {
      return false;
    }
    this._muted = true;
    let success = false;
    try {
      success = await this.sdk.rewardedBreak();
    } catch (e) {
      success = false;
    } finally {
      this._muted = false;
    }
    return success === true;
  }

  // Map the generic ad interface onto Poki's break model.
  async showInterstitial() { return this.commercialBreak(); }
  async showRewarded() { return this.rewardedBreak(); }

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
