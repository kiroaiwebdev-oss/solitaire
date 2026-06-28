/**
 * SDK integration probes: verifies platform adapters instantiate correctly,
 * all methods exist, and utility functions behave properly in Node.js environment.
 * Run with: node tests/sdk-probes.mjs
 */

import { PlatformAdapter } from '../src/platform/adapter.js';
import { StandaloneAdapter } from '../src/platform/standalone.js';
import { CrazyGamesAdapter } from '../src/platform/crazygames.js';
import { GameDistributionAdapter } from '../src/platform/gamedistribution.js';
import { Y8Adapter } from '../src/platform/y8.js';
import { PlayHopAdapter } from '../src/platform/playhop.js';
import { PokiAdapter } from '../src/platform/poki.js';
import { YouTubePlayablesAdapter } from '../src/platform/youtube.js';
import { safe, waitForGlobal, audioMuteHelper, fallbackAdOverlay } from '../src/platform/sdkUtil.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

async function test(name, fn) {
  console.log(`  Test: ${name}`);
  try {
    await fn();
  } catch (e) {
    failed++;
    console.error(`  FAIL (exception): ${name} - ${e.message}`);
  }
}

async function run() {
  console.log('=== SDK Integration Probes ===\n');

  // --- Required adapter methods ---
  const requiredMethods = [
    'init',
    'showBanner',
    'showInterstitial',
    'showRewarded',
    'hideBanner',
    'showBannerAd',
    'showInterstitialAd',
    'showRewardedAd',
    'gameStart',
    'gameOver',
    'happyMoment',
    'happyTime',
    'gameplayStart',
    'gameplayStop',
    'loadingStart',
    'loadingFinished',
    'firstFrameReady',
    'gameReady',
    'commercialBreak',
    'rewardedBreak',
    'isAudioEnabled',
    'bindLifecycle',
    'submitScore',
    'shouldMuteAudio',
    'isAdblocked',
    'muteAudio',
    'unmuteAudio',
    'save',
    'load',
    'saveData',
    'loadData'
  ];

  // --- Adapter Instantiation Tests ---
  console.log('[Adapter Instantiation]');

  const adapterClasses = [
    { name: 'PlatformAdapter', cls: PlatformAdapter },
    { name: 'StandaloneAdapter', cls: StandaloneAdapter },
    { name: 'CrazyGamesAdapter', cls: CrazyGamesAdapter },
    { name: 'GameDistributionAdapter', cls: GameDistributionAdapter },
    { name: 'Y8Adapter', cls: Y8Adapter },
    { name: 'PlayHopAdapter', cls: PlayHopAdapter },
    { name: 'PokiAdapter', cls: PokiAdapter },
    { name: 'YouTubePlayablesAdapter', cls: YouTubePlayablesAdapter }
  ];

  for (const { name, cls } of adapterClasses) {
    await test(`${name} instantiates without errors`, async () => {
      const adapter = new cls();
      assert(adapter !== null && adapter !== undefined, `${name} instance created`);
      assert(typeof adapter === 'object', `${name} is an object`);
    });
  }

  // --- Method Existence Tests ---
  console.log('\n[Adapter Method Existence]');

  for (const { name, cls } of adapterClasses) {
    await test(`${name} has all required methods`, async () => {
      const adapter = new cls();
      for (const method of requiredMethods) {
        assert(typeof adapter[method] === 'function',
          `${name}.${method} exists and is a function`);
      }
    });
  }

  // --- Method Callability Tests (no-op calls should not throw) ---
  console.log('\n[Adapter Method Callability]');

  await test('PlatformAdapter methods are callable', async () => {
    const adapter = new PlatformAdapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    adapter.unmuteAudio();
    assert(typeof adapter.shouldMuteAudio() === 'boolean', 'shouldMuteAudio returns boolean');
    assert(typeof adapter.isAdblocked() === 'boolean', 'isAdblocked returns boolean');
    assert(true, 'PlatformAdapter synchronous methods callable without error');
  });

  await test('StandaloneAdapter methods are callable', async () => {
    const adapter = new StandaloneAdapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    assert(adapter.shouldMuteAudio() === true, 'muted after muteAudio');
    adapter.unmuteAudio();
    assert(adapter.shouldMuteAudio() === false, 'unmuted after unmuteAudio');
    assert(adapter.isAdblocked() === true, 'standalone always adblocked');
    assert(true, 'StandaloneAdapter methods callable');
  });

  await test('CrazyGamesAdapter methods are callable', async () => {
    const adapter = new CrazyGamesAdapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    assert(adapter.shouldMuteAudio() === true, 'CrazyGames muted');
    adapter.unmuteAudio();
    assert(adapter.shouldMuteAudio() === false, 'CrazyGames unmuted');
    assert(true, 'CrazyGamesAdapter methods callable');
  });

  await test('GameDistributionAdapter methods are callable', async () => {
    const adapter = new GameDistributionAdapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    assert(adapter.shouldMuteAudio() === true, 'GD muted');
    adapter.unmuteAudio();
    assert(adapter.shouldMuteAudio() === false, 'GD unmuted');
    assert(true, 'GameDistributionAdapter methods callable');
  });

  await test('Y8Adapter methods are callable', async () => {
    const adapter = new Y8Adapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    assert(adapter.shouldMuteAudio() === true, 'Y8 muted');
    adapter.unmuteAudio();
    assert(adapter.shouldMuteAudio() === false, 'Y8 unmuted');
    assert(true, 'Y8Adapter methods callable');
  });

  await test('PlayHopAdapter methods are callable', async () => {
    const adapter = new PlayHopAdapter();
    adapter.hideBanner();
    adapter.gameStart();
    adapter.gameOver(100);
    adapter.happyMoment();
    adapter.happyTime();
    adapter.gameplayStart();
    adapter.gameplayStop();
    adapter.muteAudio();
    assert(adapter.shouldMuteAudio() === true, 'PlayHop muted');
    adapter.unmuteAudio();
    assert(adapter.shouldMuteAudio() === false, 'PlayHop unmuted');
    assert(true, 'PlayHopAdapter methods callable');
  });

  // --- SDK Utility Tests ---
  console.log('\n[SDK Utilities]');

  await test('safe() handles thrown errors gracefully', async () => {
    const result = safe(() => { throw new Error('test error'); });
    assert(result === null, 'safe() returns null on thrown error');
  });

  await test('safe() returns value on success', async () => {
    const result = safe(() => 42);
    assert(result === 42, 'safe() returns 42 on success');
  });

  await test('safe() handles promise rejection', async () => {
    const result = await safe(() => Promise.reject(new Error('async error')));
    assert(result === null, 'safe() returns null on promise rejection');
  });

  await test('safe() handles undefined return', async () => {
    const result = safe(() => undefined);
    assert(result === undefined, 'safe() returns undefined when function returns undefined');
  });

  await test('safe() handles null return', async () => {
    const result = safe(() => null);
    assert(result === null, 'safe() returns null when function returns null');
  });

  await test('waitForGlobal rejects on timeout', async () => {
    try {
      await waitForGlobal('__NONEXISTENT_GLOBAL_FOR_TEST__', 10);
      assert(false, 'should have rejected');
    } catch (e) {
      assert(e.message.includes('Timed out'), 'rejects with timeout message');
      assert(e.message.includes('__NONEXISTENT_GLOBAL_FOR_TEST__'),
        'error message includes variable name');
    }
  });

  await test('waitForGlobal resolves when global exists', async () => {
    globalThis.window.__TEST_GLOBAL__ = { value: 'hello' };
    try {
      const result = await waitForGlobal('__TEST_GLOBAL__', 100);
      assert(result.value === 'hello', 'resolves with the global value');
    } finally {
      delete globalThis.window.__TEST_GLOBAL__;
    }
  });

  await test('audioMuteHelper exists and is callable', async () => {
    assert(typeof audioMuteHelper === 'function', 'audioMuteHelper is a function');
    // Should not throw with null audioCtx
    audioMuteHelper(null, true);
    audioMuteHelper(null, false);
    assert(true, 'audioMuteHelper handles null context');
  });

  await test('fallbackAdOverlay exists and is callable', async () => {
    assert(typeof fallbackAdOverlay === 'function', 'fallbackAdOverlay is a function');
  });

  // --- Platform Detection Tests ---
  console.log('\n[Platform Detection]');

  await test('Adapter registry maps platform strings correctly', async () => {
    const standalone = new StandaloneAdapter();
    assert(standalone.name === 'standalone', 'StandaloneAdapter name is standalone');

    const cg = new CrazyGamesAdapter();
    assert(cg.name === 'crazygames', 'CrazyGamesAdapter name is crazygames');

    const gd = new GameDistributionAdapter();
    assert(gd.name === 'gamedistribution', 'GameDistributionAdapter name is gamedistribution');

    const y8 = new Y8Adapter();
    assert(y8.name === 'y8', 'Y8Adapter name is y8');

    const ph = new PlayHopAdapter();
    assert(ph.name === 'playhop', 'PlayHopAdapter name is playhop');

    const poki = new PokiAdapter();
    assert(poki.name === 'poki', 'PokiAdapter name is poki');

    const yt = new YouTubePlayablesAdapter();
    assert(yt.name === 'youtube', 'YouTubePlayablesAdapter name is youtube');
  });

  await test('All adapters extend PlatformAdapter', async () => {
    assert(new StandaloneAdapter() instanceof PlatformAdapter, 'Standalone extends PlatformAdapter');
    assert(new CrazyGamesAdapter() instanceof PlatformAdapter, 'CrazyGames extends PlatformAdapter');
    assert(new GameDistributionAdapter() instanceof PlatformAdapter, 'GameDistribution extends PlatformAdapter');
    assert(new Y8Adapter() instanceof PlatformAdapter, 'Y8 extends PlatformAdapter');
    assert(new PlayHopAdapter() instanceof PlatformAdapter, 'PlayHop extends PlatformAdapter');
    assert(new PokiAdapter() instanceof PlatformAdapter, 'Poki extends PlatformAdapter');
    assert(new YouTubePlayablesAdapter() instanceof PlatformAdapter, 'YouTube extends PlatformAdapter');
  });

  await test('getAdapter returns correct adapter for platform strings', async () => {
    // Save originals
    const origPlatform = globalThis.window.__PLATFORM__;
    const origLocation = globalThis.window.location;

    // Mock location to avoid URLSearchParams issues
    globalThis.window.location = { search: '' };

    // Test each platform string via the adapter registry
    const platformTests = ['standalone', 'crazygames', 'gamedistribution', 'y8', 'playhop', 'poki', 'youtube'];

    for (const platform of platformTests) {
      globalThis.window.__PLATFORM__ = platform;
      // Dynamic import with unique query to avoid module cache
      const mod = await import(`../src/platform/index.js?probe=${platform}`);
      const adapter = mod.getAdapter();
      assert(adapter.name === platform, `getAdapter returns ${platform} adapter for __PLATFORM__='${platform}'`);
    }

    // Restore
    globalThis.window.__PLATFORM__ = origPlatform;
    globalThis.window.location = origLocation;
  });

  // --- Adapter Initialization (without real SDKs) ---
  console.log('\n[Adapter Initialization Without SDKs]');

  await test('StandaloneAdapter init completes', async () => {
    const adapter = new StandaloneAdapter();
    await adapter.init();
    assert(adapter.initialized === true, 'StandaloneAdapter initializes successfully');
  });

  await test('CrazyGamesAdapter init completes (no SDK)', async () => {
    const adapter = new CrazyGamesAdapter();
    await adapter.init();
    assert(adapter.initialized === true, 'CrazyGamesAdapter initializes even without SDK');
    assert(adapter.isAdblocked() === true, 'adblocked when SDK not available');
  });

  await test('GameDistributionAdapter init completes (no SDK)', async () => {
    const adapter = new GameDistributionAdapter();
    await adapter.init();
    assert(adapter.initialized === true, 'GameDistributionAdapter initializes even without SDK');
    assert(adapter.isAdblocked() === true, 'adblocked when SDK not available');
  });

  await test('Y8Adapter init completes (no SDK)', async () => {
    const adapter = new Y8Adapter();
    await adapter.init();
    assert(adapter.initialized === true, 'Y8Adapter initializes even without SDK');
    assert(adapter.isAdblocked() === true, 'adblocked when SDK not available');
  });

  await test('PlayHopAdapter init completes (no SDK)', async () => {
    const adapter = new PlayHopAdapter();
    await adapter.init();
    assert(adapter.initialized === true, 'PlayHopAdapter initializes even without SDK');
    assert(adapter.isAdblocked() === true, 'adblocked when SDK not available');
  });

  // --- Poki: mocked PokiSDK global ---
  console.log('\n[Poki SDK Integration (mocked PokiSDK)]');

  function makePokiMock() {
    const calls = { init: 0, setDebug: 0, gameLoadingStart: 0, gameLoadingFinished: 0, gameplayStart: 0, gameplayStop: 0, commercialBreak: 0, rewardedBreak: 0 };
    let reward = true;
    const sdk = {
      _calls: calls,
      _setReward: (v) => { reward = v; },
      init: () => { calls.init++; return Promise.resolve(); },
      setDebug: () => { calls.setDebug++; },
      gameLoadingStart: () => { calls.gameLoadingStart++; },
      gameLoadingFinished: () => { calls.gameLoadingFinished++; },
      gameplayStart: () => { calls.gameplayStart++; },
      gameplayStop: () => { calls.gameplayStop++; },
      commercialBreak: () => { calls.commercialBreak++; return Promise.resolve(); },
      rewardedBreak: () => { calls.rewardedBreak++; return Promise.resolve(reward); }
    };
    return sdk;
  }

  await test('Poki init() + gameLoadingStart fire; gameLoadingFinished after load', async () => {
    globalThis.window.PokiSDK = makePokiMock();
    const a = new PokiAdapter();
    await a.init();
    assert(window.PokiSDK._calls.init === 1, 'PokiSDK.init() called once');
    assert(window.PokiSDK._calls.gameLoadingStart >= 1, 'gameLoadingStart() called during loading');
    assert(window.PokiSDK._calls.gameLoadingFinished === 0, 'gameLoadingFinished() not called yet');
    a.loadingFinished();
    assert(window.PokiSDK._calls.gameLoadingFinished === 1, 'gameLoadingFinished() called when menu ready');
    delete globalThis.window.PokiSDK;
  });

  await test('Poki gameplayStart/Stop fire on round start/stop', async () => {
    globalThis.window.PokiSDK = makePokiMock();
    const a = new PokiAdapter();
    await a.init();
    a.gameplayStart();
    assert(window.PokiSDK._calls.gameplayStart === 1, 'gameplayStart() forwarded');
    a.gameplayStop();
    assert(window.PokiSDK._calls.gameplayStop === 1, 'gameplayStop() forwarded');
    delete globalThis.window.PokiSDK;
  });

  await test('Poki commercialBreak awaited before resuming; audio muted during + restored after', async () => {
    globalThis.window.PokiSDK = makePokiMock();
    const a = new PokiAdapter();
    await a.init();
    assert(a.shouldMuteAudio() === false, 'not muted before break');
    const p = a.commercialBreak();
    assert(a.shouldMuteAudio() === true, 'audio muted DURING commercial break');
    await p;
    assert(window.PokiSDK._calls.commercialBreak === 1, 'commercialBreak() awaited');
    assert(a.shouldMuteAudio() === false, 'audio restored AFTER commercial break');
    delete globalThis.window.PokiSDK;
  });

  await test('Poki rewardedBreak grants ONLY when watched; denies safely otherwise', async () => {
    globalThis.window.PokiSDK = makePokiMock();
    const a = new PokiAdapter();
    await a.init();
    window.PokiSDK._setReward(true);
    const granted = await a.rewardedBreak();
    assert(granted === true, 'reward granted when ad watched to completion');
    window.PokiSDK._setReward(false);
    const denied = await a.rewardedBreak();
    assert(denied === false, 'reward denied when not watched (no crash)');
    assert(a.shouldMuteAudio() === false, 'audio restored after rewarded break');
    delete globalThis.window.PokiSDK;
  });

  await test('Poki adblock/missing SDK is safe (no crash, no reward, no soft-lock)', async () => {
    // No PokiSDK global at all -> init falls back, breaks resolve safely.
    const a = new PokiAdapter();
    a.initialized = true; // skip the 8s waitForGlobal; exercise the guarded paths
    const cb = await a.commercialBreak();
    assert(cb === true, 'commercialBreak resolves safely with no SDK');
    const rb = await a.rewardedBreak();
    assert(rb === false, 'rewardedBreak resolves false with no SDK (no reward)');
  });

  // --- YouTube Playables: mocked ytgame global ---
  console.log('\n[YouTube Playables Integration (mocked ytgame)]');

  function makeYtMock() {
    const calls = { firstFrameReady: 0, gameReady: 0, sendScore: 0, loadData: 0, saveData: 0 };
    const state = { pauseCb: null, resumeCb: null, audioCb: null, audioEnabled: true, store: '', lastScore: null, order: [] };
    const yt = {
      _calls: calls,
      _state: state,
      _firePause: () => { if (state.pauseCb) state.pauseCb(); },
      _fireResume: () => { if (state.resumeCb) state.resumeCb(); },
      _setAudio: (v) => { state.audioEnabled = v; if (state.audioCb) state.audioCb(v); },
      game: {
        firstFrameReady: () => { calls.firstFrameReady++; state.order.push('first'); },
        gameReady: () => { calls.gameReady++; state.order.push('ready'); },
        loadData: () => { calls.loadData++; return Promise.resolve(state.store); },
        saveData: (s) => { calls.saveData++; state.store = s; return Promise.resolve(); }
      },
      system: {
        isAudioEnabled: () => state.audioEnabled,
        onPause: (cb) => { state.pauseCb = cb; },
        onResume: (cb) => { state.resumeCb = cb; },
        onAudioEnabledChange: (cb) => { state.audioCb = cb; }
      },
      engagement: { sendScore: ({ value }) => { calls.sendScore++; state.lastScore = value; } },
      health: { logError: () => {}, logWarning: () => {} }
    };
    return yt;
  }

  await test('ytgame present -> getAdapter selects the youtube adapter', async () => {
    const origPlatform = globalThis.window.__PLATFORM__;
    const origLocation = globalThis.window.location;
    delete globalThis.window.__PLATFORM__;
    globalThis.window.location = { search: '' };
    globalThis.window.ytgame = makeYtMock();
    const mod = await import('../src/platform/index.js?ytdetect=1');
    const adapter = mod.getAdapter();
    assert(adapter.name === 'youtube', 'window.ytgame detected -> youtube adapter');
    delete globalThis.window.ytgame;
    globalThis.window.__PLATFORM__ = origPlatform;
    globalThis.window.location = origLocation;
  });

  await test('YouTube loading handshake: firstFrameReady THEN gameReady (in order)', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    assert(window.ytgame._calls.loadData === 1, 'cloud loadData pulled on init');
    a.firstFrameReady();
    a.gameReady();
    assert(window.ytgame._calls.firstFrameReady === 1, 'firstFrameReady() called once');
    assert(window.ytgame._calls.gameReady === 1, 'gameReady() called once');
    assert(window.ytgame._state.order.join(',') === 'first,ready', 'firstFrameReady fired before gameReady');
    delete globalThis.window.ytgame;
  });

  await test('YouTube gameReady() never precedes firstFrameReady() even if called first', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    a.gameReady(); // called out of order on purpose
    assert(window.ytgame._state.order.join(',') === 'first,ready', 'adapter forces firstFrameReady before gameReady');
    delete globalThis.window.ytgame;
  });

  await test('YouTube onPause pauses+mutes; onResume resumes (via bindLifecycle)', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    let paused = false, resumed = false;
    a.bindLifecycle({ onPause: () => { paused = true; }, onResume: () => { resumed = true; } });
    window.ytgame._firePause();
    assert(paused === true, 'onPause handler invoked');
    assert(a.shouldMuteAudio() === true, 'audio muted on pause');
    window.ytgame._fireResume();
    assert(resumed === true, 'onResume handler invoked');
    assert(a.shouldMuteAudio() === false, 'audio unmuted on resume');
    delete globalThis.window.ytgame;
  });

  await test('YouTube isAudioEnabled() + onAudioEnabledChange respected (platform owns audio)', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    let changed = false;
    a.bindLifecycle({ onAudioChange: () => { changed = true; } });
    assert(a.isAudioEnabled() === true, 'audio enabled initially');
    window.ytgame._setAudio(false);
    assert(a.isAudioEnabled() === false, 'platform audio-disabled state reflected');
    assert(changed === true, 'onAudioEnabledChange handler invoked');
    delete globalThis.window.ytgame;
  });

  await test('YouTube loadData/saveData cloud round-trip via the adapter', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    a.saveData('solitaire_ytcloud', { x: 42, name: 'klondike' });
    // Cloud push is microtask-debounced; let it flush.
    await Promise.resolve(); await Promise.resolve();
    const blob = window.ytgame._state.store;
    assert(typeof blob === 'string' && blob.includes('solitaire_ytcloud'), 'saveData wrote a cloud blob');
    // Wipe the local mirror to prove the value is restored FROM the cloud.
    globalThis.localStorage.removeItem('solitaire_ytcloud');
    const b = new YouTubePlayablesAdapter();
    await b.init(); // pulls the same mocked cloud store
    const loaded = b.loadData('solitaire_ytcloud');
    assert(loaded && loaded.x === 42 && loaded.name === 'klondike', 'value restored from cloud on a fresh adapter');
    delete globalThis.window.ytgame;
  });

  await test('YouTube falls back to localStorage when ytgame is absent', async () => {
    const a = new YouTubePlayablesAdapter();
    // No ytgame, no init: pure localStorage fallback.
    a.saveData('solitaire_ytlocal', { v: 9 });
    const loaded = a.loadData('solitaire_ytlocal');
    assert(loaded && loaded.v === 9, 'save/load works without ytgame (localStorage fallback)');
  });

  await test('YouTube sendScore() called on win (guarded)', async () => {
    globalThis.window.ytgame = makeYtMock();
    const a = new YouTubePlayablesAdapter();
    await a.init();
    a.submitScore(1875);
    assert(window.ytgame._calls.sendScore === 1, 'engagement.sendScore called');
    assert(window.ytgame._state.lastScore === 1875, 'score value forwarded to sendScore');
    delete globalThis.window.ytgame;
  });

  // --- CrazyGames: mocked CrazyGames.SDK global ---
  console.log('\n[CrazyGames SDK v3 Integration (mocked CrazyGames.SDK)]');

  function makeCGMock(opts = {}) {
    const calls = { init: 0, sdkGameLoadingStart: 0, sdkGameLoadingFinished: 0, gameplayStart: 0, gameplayStop: 0, midgame: 0, rewarded: 0, hasAdblock: 0 };
    const cfg = { adblock: opts.adblock || false, adMode: opts.adMode || 'finish' };
    const SDK = {
      _calls: calls,
      _cfg: cfg,
      init: () => { calls.init++; return Promise.resolve(); },
      game: {
        sdkGameLoadingStart: () => { calls.sdkGameLoadingStart++; },
        sdkGameLoadingFinished: () => { calls.sdkGameLoadingFinished++; },
        gameplayStart: () => { calls.gameplayStart++; },
        gameplayStop: () => { calls.gameplayStop++; },
        happytime: () => {}
      },
      ad: {
        hasAdblock: () => { calls.hasAdblock++; return Promise.resolve(cfg.adblock); },
        requestAd: (type, cbs) => {
          if (type === 'midgame') calls.midgame++; else calls.rewarded++;
          setTimeout(() => {
            if (cbs.adStarted) cbs.adStarted();
            if (cfg.adMode === 'finish') { if (cbs.adFinished) cbs.adFinished(); }
            else { if (cbs.adError) cbs.adError(); }
          }, 0);
        }
      }
    };
    return { SDK };
  }

  await test('CrazyGames v3: init() + sdkGameLoadingStart fire; SDK read from .SDK', async () => {
    globalThis.window.CrazyGames = makeCGMock();
    const a = new CrazyGamesAdapter();
    await a.init();
    assert(window.CrazyGames.SDK._calls.init === 1, 'SDK.init() called');
    assert(window.CrazyGames.SDK._calls.sdkGameLoadingStart >= 1, 'sdkGameLoadingStart() called on init');
    a.loadingFinished();
    assert(window.CrazyGames.SDK._calls.sdkGameLoadingFinished === 1, 'sdkGameLoadingFinished() called');
    delete globalThis.window.CrazyGames;
  });

  await test('CrazyGames ads do NOT fire during active gameplay (only on explicit request)', async () => {
    globalThis.window.CrazyGames = makeCGMock();
    const a = new CrazyGamesAdapter();
    await a.init();
    a.gameplayStart();
    a.gameplayStop();
    assert(window.CrazyGames.SDK._calls.midgame === 0, 'no midgame ad requested by gameplay transitions');
    assert(window.CrazyGames.SDK._calls.rewarded === 0, 'no rewarded ad requested by gameplay transitions');
    assert(window.CrazyGames.SDK._calls.gameplayStart === 1 && window.CrazyGames.SDK._calls.gameplayStop === 1, 'gameplayStart/Stop forwarded');
    delete globalThis.window.CrazyGames;
  });

  await test('CrazyGames rewarded grants ONLY on adFinished, not adError', async () => {
    globalThis.window.CrazyGames = makeCGMock({ adMode: 'finish' });
    let a = new CrazyGamesAdapter();
    await a.init();
    const won = await a.showRewarded();
    assert(won === true, 'rewarded resolves true on adFinished');
    assert(a.shouldMuteAudio() === false, 'audio restored after rewarded ad');
    delete globalThis.window.CrazyGames;

    globalThis.window.CrazyGames = makeCGMock({ adMode: 'error' });
    a = new CrazyGamesAdapter();
    await a.init();
    const lost = await a.showRewarded();
    assert(lost === false, 'rewarded resolves false on adError (no reward)');
    delete globalThis.window.CrazyGames;
  });

  await test('CrazyGames midgame mutes during ad and restores after', async () => {
    globalThis.window.CrazyGames = makeCGMock({ adMode: 'finish' });
    const a = new CrazyGamesAdapter();
    await a.init();
    const result = await a.showInterstitial();
    assert(result === true, 'interstitial resolves');
    assert(window.CrazyGames.SDK._calls.midgame === 1, 'midgame ad requested');
    assert(a.shouldMuteAudio() === false, 'audio restored after midgame ad');
    delete globalThis.window.CrazyGames;
  });

  await test('CrazyGames adblock-safe: missing SDK never crashes or soft-locks', async () => {
    const a = new CrazyGamesAdapter(); // no init -> this.sdk stays null
    const r = await a.showRewarded();
    assert(r === false, 'rewarded false when SDK absent (no soft-lock)');
    const i = await a.showInterstitial(); // shows brief fallback overlay, resolves
    assert(i === true, 'interstitial resolves safely when SDK absent');
  });

  // --- Build validation: per-portal injection + compliance ---
  console.log('\n[Build Validation (per-portal index.html)]');

  await test('dist builds exist (build them if needed)', async () => {
    const ytIndex = join(rootDir, 'dist', 'youtube', 'index.html');
    if (!existsSync(ytIndex)) {
      const env = { ...process.env };
      delete env.NODE_OPTIONS;
      execFileSync('node', ['tools/build.mjs'], { cwd: rootDir, env, stdio: 'ignore' });
    }
    assert(existsSync(ytIndex), 'dist/youtube/index.html present after build');
  });

  await test('YouTube build injects the YT SDK BEFORE the main.js module script', async () => {
    const html = readFileSync(join(rootDir, 'dist', 'youtube', 'index.html'), 'utf8');
    const sdkIdx = html.indexOf('https://www.youtube.com/game_api/v1');
    const moduleIdx = html.indexOf('src="src/main.js"');
    assert(sdkIdx > -1, 'YT Playables SDK script injected');
    assert(moduleIdx > -1, 'main.js module script present');
    assert(sdkIdx < moduleIdx, 'YT SDK appears BEFORE the module script');
  });

  await test('YouTube build does NOT register a cross-origin-fetching service worker', async () => {
    const html = readFileSync(join(rootDir, 'dist', 'youtube', 'index.html'), 'utf8');
    assert(html.includes("plat === 'youtube'"), 'SW registration is gated for youtube');
    // The gate returns before reaching navigator.serviceWorker.register.
    const gateIdx = html.indexOf("plat === 'youtube'");
    const regIdx = html.indexOf('serviceWorker.register');
    assert(gateIdx > -1 && (regIdx === -1 || gateIdx < regIdx), 'youtube gate precedes any SW registration');
  });

  await test('YouTube build injects NO external SDK other than the YT SDK', async () => {
    const html = readFileSync(join(rootDir, 'dist', 'youtube', 'index.html'), 'utf8');
    const forbidden = [
      'sdk.crazygames.com',
      'game-cdn.poki.com',
      'html5.api.gamedistribution.com',
      'cdn.y8.com',
      'cdn.playgama.com'
    ];
    for (const url of forbidden) {
      assert(!html.includes(url), `youtube build does not inject ${url}`);
    }
  });

  await test('Poki build injects the Poki SDK in <head>', async () => {
    const html = readFileSync(join(rootDir, 'dist', 'poki', 'index.html'), 'utf8');
    assert(html.includes('https://game-cdn.poki.com/scripts/v2/poki-sdk.js'), 'Poki SDK script injected');
    assert(html.includes("window.__PLATFORM__ = 'poki'"), 'poki platform marker injected');
    const sdkIdx = html.indexOf('poki-sdk.js');
    const headEnd = html.indexOf('</head>');
    assert(sdkIdx > -1 && headEnd > -1 && sdkIdx < headEnd, 'Poki SDK injected inside <head>');
  });

  await test('CrazyGames build still injects the v3 SDK', async () => {
    const html = readFileSync(join(rootDir, 'dist', 'crazygames', 'index.html'), 'utf8');
    assert(html.includes('https://sdk.crazygames.com/crazygames-sdk-v3.js'), 'CrazyGames v3 SDK injected');
  });

  // --- Summary ---
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All SDK probes passed!');
  }
}

// Set up minimal browser globals for Node.js test environment
// Must be set before any adapter method calls since they reference window/document
globalThis.window = globalThis.window || {};
globalThis.window.location = globalThis.window.location || { search: '' };
globalThis.document = globalThis.document || {
  createElement: (tag) => ({
    style: { cssText: '' },
    textContent: '',
    id: '',
    appendChild: () => {},
    remove: () => {}
  }),
  body: { appendChild: () => {} },
  getElementById: () => null
};
globalThis.localStorage = globalThis.localStorage || {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; }
};

run();
