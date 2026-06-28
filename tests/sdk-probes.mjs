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
import { safe, waitForGlobal, audioMuteHelper, fallbackAdOverlay } from '../src/platform/sdkUtil.js';

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
    { name: 'PlayHopAdapter', cls: PlayHopAdapter }
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
  });

  await test('All adapters extend PlatformAdapter', async () => {
    assert(new StandaloneAdapter() instanceof PlatformAdapter, 'Standalone extends PlatformAdapter');
    assert(new CrazyGamesAdapter() instanceof PlatformAdapter, 'CrazyGames extends PlatformAdapter');
    assert(new GameDistributionAdapter() instanceof PlatformAdapter, 'GameDistribution extends PlatformAdapter');
    assert(new Y8Adapter() instanceof PlatformAdapter, 'Y8 extends PlatformAdapter');
    assert(new PlayHopAdapter() instanceof PlatformAdapter, 'PlayHop extends PlatformAdapter');
  });

  await test('getAdapter returns correct adapter for platform strings', async () => {
    // Save originals
    const origPlatform = globalThis.window.__PLATFORM__;
    const origLocation = globalThis.window.location;

    // Mock location to avoid URLSearchParams issues
    globalThis.window.location = { search: '' };

    // Test each platform string via the adapter registry
    const platformTests = ['standalone', 'crazygames', 'gamedistribution', 'y8', 'playhop'];

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
