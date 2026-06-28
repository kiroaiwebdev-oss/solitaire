/**
 * YouTube Playables platform adapter.
 * SDK: https://www.youtube.com/game_api/v1  (global: ytgame)
 *
 * The SDK <script> MUST be loaded BEFORE any game code (the 'youtube' build
 * injects it in <head> above the main.js module). This adapter integrates:
 *   - Loading handshake (CRITICAL): ytgame.game.firstFrameReady() once the
 *     first frame rendered, then ytgame.game.gameReady() when ready for input.
 *   - ytgame.system.onPause(cb) / onResume(cb)  -> pause+mute / resume.
 *   - ytgame.system.isAudioEnabled() / onAudioEnabledChange(cb) -> platform
 *     audio state takes priority over the in-game sound toggle.
 *   - ytgame.game.loadData()/saveData(string)   -> cloud save (mirrored to a
 *     synchronous store so the existing SaveManager interface keeps working);
 *     falls back to localStorage when ytgame is absent.
 *   - ytgame.engagement.sendScore({ value })    -> on a win (guarded).
 *   - ytgame.health.logError/logWarning         -> wrap risky calls.
 *
 * COMPLIANCE: makes NO external network requests except the YT SDK itself.
 * Everything is self-contained and works fully offline.
 */

import { PlatformAdapter } from './adapter.js';
import { waitForGlobal } from './sdkUtil.js';

export class YouTubePlayablesAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'youtube';
    this.yt = null;
    this._muted = false;
    this._audioEnabled = true;
    this._store = {};            // in-memory mirror of cloud save (parsed values)
    this._lifecycle = {};
    this._firstFrameSent = false;
    this._gameReadySent = false;
    this._cloudReady = false;
    this._savePending = false;
  }

  async init() {
    try {
      this.yt = await waitForGlobal('ytgame', 8000);
    } catch (e) {
      console.warn('[YouTube Playables] SDK not present, using localStorage fallback');
      this.yt = null;
    }

    if (this.yt) {
      // Audio state is owned by the platform.
      this._readAudioEnabled();
      this._wireSystemEvents();
      // Pull cloud save into the synchronous mirror.
      await this._cloudLoad();
    }

    this.initialized = true;
    console.log('[Platform] YouTube Playables mode');
  }

  // --- Health-guarded call helper ---
  _health(fn, label) {
    try {
      return fn();
    } catch (e) {
      try {
        if (this.yt && this.yt.health && typeof this.yt.health.logError === 'function') {
          this.yt.health.logError(label || (e && e.message) || 'error');
        }
      } catch (_) {}
      return null;
    }
  }

  _readAudioEnabled() {
    if (this.yt && this.yt.system && typeof this.yt.system.isAudioEnabled === 'function') {
      this._audioEnabled = this._health(() => this.yt.system.isAudioEnabled(), 'isAudioEnabled') !== false;
    }
  }

  _wireSystemEvents() {
    const sys = this.yt && this.yt.system;
    if (!sys) return;
    if (typeof sys.onPause === 'function') {
      this._health(() => sys.onPause(() => {
        this._muted = true;
        if (this._lifecycle && typeof this._lifecycle.onPause === 'function') this._lifecycle.onPause();
      }), 'onPause');
    }
    if (typeof sys.onResume === 'function') {
      this._health(() => sys.onResume(() => {
        this._muted = false;
        if (this._lifecycle && typeof this._lifecycle.onResume === 'function') this._lifecycle.onResume();
      }), 'onResume');
    }
    if (typeof sys.onAudioEnabledChange === 'function') {
      this._health(() => sys.onAudioEnabledChange((enabled) => {
        this._audioEnabled = enabled !== false;
        if (this._lifecycle && typeof this._lifecycle.onAudioChange === 'function') {
          this._lifecycle.onAudioChange(this._audioEnabled);
        }
      }), 'onAudioEnabledChange');
    }
  }

  bindLifecycle(handlers) {
    this._lifecycle = handlers || {};
  }

  // --- Loading handshake (ORDER MATTERS: firstFrameReady THEN gameReady) ---

  firstFrameReady() {
    if (this._firstFrameSent) return;
    this._firstFrameSent = true;
    if (this.yt && this.yt.game && typeof this.yt.game.firstFrameReady === 'function') {
      this._health(() => this.yt.game.firstFrameReady(), 'firstFrameReady');
    }
  }

  gameReady() {
    if (this._gameReadySent) return;
    // gameReady must never precede firstFrameReady.
    if (!this._firstFrameSent) this.firstFrameReady();
    this._gameReadySent = true;
    if (this.yt && this.yt.game && typeof this.yt.game.gameReady === 'function') {
      this._health(() => this.yt.game.gameReady(), 'gameReady');
    }
  }

  // loadingFinished is the generic hook; map it to gameReady for YT.
  loadingFinished() { this.gameReady(); }

  // --- Audio ---
  isAudioEnabled() { return this._audioEnabled !== false; }
  shouldMuteAudio() { return this._muted; }
  muteAudio() { this._muted = true; }
  unmuteAudio() { this._muted = false; }

  // --- Score ---
  submitScore(score) {
    if (this.yt && this.yt.engagement && typeof this.yt.engagement.sendScore === 'function') {
      this._health(() => this.yt.engagement.sendScore({ value: Number(score) || 0 }), 'sendScore');
    }
  }

  // --- Cloud save (mirrored into a synchronous store) ---

  async _cloudLoad() {
    if (!(this.yt && this.yt.game && typeof this.yt.game.loadData === 'function')) {
      this._cloudReady = true;
      return;
    }
    try {
      const blob = await this.yt.game.loadData();
      if (blob && typeof blob === 'string') {
        const parsed = JSON.parse(blob);
        if (parsed && typeof parsed === 'object') {
          this._store = parsed;
          // Mirror into localStorage so any sync reader stays consistent.
          for (const k of Object.keys(parsed)) {
            try { localStorage.setItem(k, JSON.stringify(parsed[k])); } catch (e) {}
          }
        }
      }
    } catch (e) {
      this._health(() => { throw e; }, 'loadData');
    }
    this._cloudReady = true;
  }

  _cloudSave() {
    if (!(this.yt && this.yt.game && typeof this.yt.game.saveData === 'function')) return;
    // Coalesce rapid saves into a single microtask push.
    if (this._savePending) return;
    this._savePending = true;
    const flush = () => {
      this._savePending = false;
      try {
        const p = this.yt.game.saveData(JSON.stringify(this._store));
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {
        this._health(() => { throw e; }, 'saveData');
      }
    };
    if (typeof Promise !== 'undefined') Promise.resolve().then(flush);
    else flush();
  }

  save(key, data) {
    this._store[key] = data;
    // Local mirror (offline-safe) + cloud push.
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    this._cloudSave();
  }

  load(key) {
    if (Object.prototype.hasOwnProperty.call(this._store, key)) {
      return this._store[key];
    }
    try {
      const d = localStorage.getItem(key);
      const v = d ? JSON.parse(d) : null;
      if (v !== null) this._store[key] = v;
      return v;
    } catch (e) {
      return null;
    }
  }

  saveData(key, data) { this.save(key, data); }
  loadData(key) { return this.load(key); }

  // --- Ads: YouTube Playables has no ad breaks; keep everything a safe no-op. ---
  async showBanner() {}
  async showInterstitial() { return true; }
  async showRewarded() { return false; }
  async commercialBreak() { return true; }
  async rewardedBreak() { return false; }
  hideBanner() {}
  isAdblocked() { return true; }

  showBannerAd() { return this.showBanner(); }
  showInterstitialAd() { return this.showInterstitial(); }
  async showRewardedAd(callback) {
    const result = await this.showRewarded();
    if (callback) callback(result);
    return result;
  }

  happyTime() { this.happyMoment(); }
}
