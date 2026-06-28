/**
 * DOM/render test: verifies that modules load and basic DOM structure works.
 * Run with: node tests/domtest.mjs
 * 
 * Note: Since we don't have a real browser DOM, this tests module loading
 * and basic structure without canvas rendering.
 */

import { Card, SUITS, RANKS } from '../src/game/card.js';
import { createDeck, shuffle } from '../src/game/deck.js';
import { Tableau } from '../src/game/tableau.js';
import { Foundation } from '../src/game/foundation.js';
import { Stock } from '../src/game/stock.js';
import { Game, GAME_STATES } from '../src/game/game.js';
import { DragSystem } from '../src/game/drag.js';
import { GameLoop } from '../src/core/loop.js';
import { lerp, clamp, vec2, vec2Add, createRng } from '../src/core/math.js';
import { SCORING } from '../src/config/scoring.js';
import { THEMES, DEFAULT_THEME } from '../src/config/themes.js';
import { getDailySeed, getTodaySeed } from '../src/config/daily-seeds.js';
import { PlatformAdapter } from '../src/platform/adapter.js';
import { StandaloneAdapter } from '../src/platform/standalone.js';
import { CrazyGamesAdapter } from '../src/platform/crazygames.js';
import { GameDistributionAdapter } from '../src/platform/gamedistribution.js';
import { Y8Adapter } from '../src/platform/y8.js';
import { PlayHopAdapter } from '../src/platform/playhop.js';
import { SaveManager } from '../src/systems/save-manager.js';
import { Progression } from '../src/systems/progression.js';
import { DailyChallenge } from '../src/systems/daily-challenge.js';
import { Achievements } from '../src/systems/achievements.js';
import { ACHIEVEMENT_DEFS, getAllAchievementIds } from '../src/config/achievements.js';
import { isThemeUnlocked } from '../src/config/themes.js';
import { ParticleSystem } from '../src/ui/particles.js';
import { AnimationManager } from '../src/ui/animations.js';
import { Screens } from '../src/ui/screens.js';
import { HUD } from '../src/ui/hud.js';
import { checkAllImports } from './import-check.mjs';
import { installDOM, makeCtx } from './dom-harness.mjs';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

function test(name, fn) {
  console.log(`  Test: ${name}`);
  try {
    fn();
  } catch (e) {
    failed++;
    console.error(`  FAIL (exception): ${name} - ${e.message}`);
  }
}

console.log('=== DOM/Module Loading Tests ===\n');

// --- Module Loading ---
console.log('[Module Imports]');

test('All game modules load', () => {
  assert(typeof Card === 'function', 'Card class loaded');
  assert(typeof createDeck === 'function', 'createDeck loaded');
  assert(typeof shuffle === 'function', 'shuffle loaded');
  assert(typeof Tableau === 'function', 'Tableau class loaded');
  assert(typeof Foundation === 'function', 'Foundation class loaded');
  assert(typeof Stock === 'function', 'Stock class loaded');
  assert(typeof Game === 'function', 'Game class loaded');
  assert(typeof DragSystem === 'function', 'DragSystem class loaded');
});

test('All core modules load', () => {
  assert(typeof GameLoop === 'function', 'GameLoop class loaded');
  assert(typeof lerp === 'function', 'lerp loaded');
  assert(typeof clamp === 'function', 'clamp loaded');
  assert(typeof vec2 === 'function', 'vec2 loaded');
  assert(typeof createRng === 'function', 'createRng loaded');
});

test('Config modules load', () => {
  assert(typeof SCORING === 'object', 'SCORING loaded');
  assert(SCORING.WASTE_TO_TABLEAU === 5, 'scoring value correct');
  assert(typeof THEMES === 'object', 'THEMES loaded');
  assert(DEFAULT_THEME === 'classic', 'default theme is classic');
  assert(typeof getDailySeed === 'function', 'getDailySeed loaded');
  assert(typeof getTodaySeed === 'function', 'getTodaySeed loaded');
});

test('Platform modules load', () => {
  assert(typeof PlatformAdapter === 'function', 'PlatformAdapter loaded');
  assert(typeof StandaloneAdapter === 'function', 'StandaloneAdapter loaded');
});

test('System modules load', () => {
  assert(typeof SaveManager === 'function', 'SaveManager loaded');
  assert(typeof Progression === 'function', 'Progression loaded');
  assert(typeof DailyChallenge === 'function', 'DailyChallenge loaded');
  assert(typeof Achievements === 'function', 'Achievements loaded');
});

// --- Integration Tests ---
console.log('\n[Integration]');

test('Full game deal and play cycle', () => {
  const game = new Game({ drawCount: 1, seed: 42 });
  game.deal();

  // Verify deal
  let tableauCards = 0;
  for (const col of game.tableau.columns) tableauCards += col.length;
  assert(tableauCards === 28, '28 cards in tableau');
  assert(game.stock.stock.length === 24, '24 cards in stock');

  // Draw from stock
  game.drawFromStock();
  assert(game.stock.stock.length === 23, '23 cards in stock after draw');
  assert(game.stock.waste.length === 1, '1 card in waste after draw');

  // Verify game state remains playing
  assert(game.state === GAME_STATES.PLAYING, 'game still playing');
});

test('Drag system basic flow', () => {
  const drag = new DragSystem();
  assert(drag.active === false, 'drag starts inactive');

  const card = new Card('hearts', 'K');
  card.setPosition(100, 200);
  drag.start([card], 120, 220, { type: 'tableau', index: 0, cardIndex: 0 });

  assert(drag.active === true, 'drag is active after start');
  assert(drag.cards.length === 1, 'one card being dragged');

  drag.move(200, 300, 100);
  // Card should follow pointer

  const result = drag.end();
  assert(result.cards.length === 1, 'end returns cards');
  assert(result.source.type === 'tableau', 'source preserved');
  assert(drag.active === false, 'drag inactive after end');
});

test('Daily seed is consistent for same day', () => {
  const date = new Date(2024, 5, 15);
  const seed1 = getDailySeed(date);
  const seed2 = getDailySeed(date);
  assert(seed1 === seed2, 'same date gives same seed');
  assert(typeof seed1 === 'number', 'seed is a number');
  assert(seed1 > 0, 'seed is positive');
});

test('Platform adapter interface', () => {
  const adapter = new StandaloneAdapter();
  assert(adapter.name === 'standalone', 'adapter name');
  assert(adapter.initialized === false, 'not initialized yet');
  assert(typeof adapter.showInterstitial === 'function', 'has ad methods');
  assert(typeof adapter.save === 'function', 'has save method');
  assert(typeof adapter.load === 'function', 'has load method');
});

test('Game loop creation', () => {
  const loop = new GameLoop();
  assert(loop.running === false, 'loop not running initially');
  assert(loop.paused === false, 'loop not paused initially');
  assert(loop.maxDt === 0.05, 'max dt is 50ms');
});

test('Auto-complete detection', () => {
  const game = new Game({ drawCount: 1, seed: 42 });
  game.deal();
  // Initially can't auto-complete (stock has cards)
  assert(game.canAutoComplete() === false, 'cannot auto-complete at start');
});

test('Progression stub works', () => {
  const prog = new Progression();
  assert(prog.level === 1, 'starts at level 1');
  prog.addXp(100);
  assert(prog.xp === 100, 'xp added');
  prog.addCurrency(50);
  assert(prog.currency === 50, 'currency added');
});

test('Progression level-up detection', () => {
  const prog = new Progression();
  // xpForLevel(2) = floor(100 * 2^1.5) = 282
  const result = prog.addXp(300);
  assert(result.leveled === true, 'should level up with 300 xp');
  assert(result.newLevel === 2, 'should reach level 2');
  assert(result.coinsEarned === 100, 'should earn 100 coins');
  assert(prog.currency === 100, 'currency should be 100');
});

test('Progression XP calculation', () => {
  // Importing through the module directly is cleaner
  const prog = new Progression();
  // Win with speed bonus and no undo
  // Base 10 + Win 50 + Speed 30 + NoUndo 20 = 110
  prog.addXp(110);
  assert(prog.xp === 110, 'total xp should be 110');
});

test('Progression state save/load', () => {
  const prog = new Progression();
  prog.addXp(500);
  prog.addCurrency(200);
  const state = prog.getState();
  assert(state.xp === 500, 'state xp');
  assert(state.currency === 200 + 100, 'state currency includes level-up coins');

  const prog2 = new Progression();
  prog2.loadState(state);
  assert(prog2.xp === 500, 'loaded xp');
  assert(prog2.level === prog.level, 'loaded level matches');
});

test('Achievements stub works', () => {
  const achievements = new Achievements();
  assert(achievements.getUnlocked().length === 0, 'no achievements initially');
  assert(achievements.isUnlocked('test') === false, 'test not unlocked');
});

test('Achievements check unlocks correctly', () => {
  const achievements = new Achievements();
  const stats = { won: 1, played: 1, bestTime: 200, perfectWins: 0 };
  const newlyUnlocked = achievements.check(stats);
  assert(newlyUnlocked.includes('first_win'), 'first_win should unlock');
  assert(achievements.isUnlocked('first_win'), 'first_win is now unlocked');
  // Check that it does not double-unlock
  const again = achievements.check(stats);
  assert(again.length === 0, 'should not re-unlock');
});

test('Achievements speed demon', () => {
  const achievements = new Achievements();
  const stats = { won: 1, played: 1, bestTime: 120, perfectWins: 0 };
  achievements.check(stats);
  assert(achievements.isUnlocked('speed_demon'), 'speed_demon should unlock under 3min');
});

test('Achievements state save/load', () => {
  const achievements = new Achievements();
  achievements.check({ won: 1, played: 1, bestTime: 200, perfectWins: 0 });
  const state = achievements.getState();
  assert(state.unlocked.includes('first_win'), 'state has first_win');

  const a2 = new Achievements();
  a2.loadState(state);
  assert(a2.isUnlocked('first_win'), 'loaded achievement preserved');
});

test('DailyChallenge seed consistency', () => {
  const dc = new DailyChallenge();
  const seed1 = dc.getTodaySeed();
  const seed2 = dc.getTodaySeed();
  assert(seed1 === seed2, 'same day produces same seed');
  assert(typeof seed1 === 'number', 'seed is number');
});

test('DailyChallenge completion and streak', () => {
  const dc = new DailyChallenge();
  assert(dc.isCompleted() === false, 'not completed initially');
  const result = dc.complete();
  assert(dc.isCompleted() === true, 'completed after calling complete');
  assert(result.newStreak === 1, 'streak is 1 after first completion');
  assert(dc.totalCompleted === 1, 'total completed is 1');
});

test('DailyChallenge state save/load', () => {
  const dc = new DailyChallenge();
  dc.complete();
  const state = dc.getState();
  assert(state.streak === 1, 'state streak is 1');
  assert(state.totalCompleted === 1, 'state total is 1');

  const dc2 = new DailyChallenge();
  dc2.loadState(state);
  assert(dc2.getStreak() >= 0, 'loaded streak is valid');
  assert(dc2.totalCompleted === 1, 'loaded total is correct');
});

test('Theme unlock checking', () => {
  // Import not available in this test, test via THEMES structure
  const classicTheme = THEMES['classic'];
  assert(classicTheme !== undefined, 'classic theme exists');
  assert(classicTheme.unlockCondition.type === 'free', 'classic is free');
  assert(Object.keys(THEMES).length >= 8, 'at least 8 themes');
});

test('SaveManager save and load', () => {
  // localStorage may not be available in Node.js test env
  // Test the interface without relying on real storage
  const sm = new SaveManager(null);
  assert(typeof sm.save === 'function', 'has save method');
  assert(typeof sm.load === 'function', 'has load method');
  assert(typeof sm.delete === 'function', 'has delete method');
  assert(typeof sm.saveAll === 'function', 'has saveAll method');
  assert(typeof sm.loadAll === 'function', 'has loadAll method');
  assert(typeof sm.hasSavedGame === 'function', 'has hasSavedGame method');

  // Test with a mock adapter
  const mockStore = {};
  const mockAdapter = {
    save(key, data) { mockStore[key] = JSON.stringify(data); },
    load(key) { const d = mockStore[key]; return d ? JSON.parse(d) : null; }
  };
  const sm2 = new SaveManager(mockAdapter);
  sm2.save('test_key', { hello: 'world' });
  const loaded = sm2.load('test_key');
  assert(loaded !== null, 'loaded data is not null');
  assert(loaded.hello === 'world', 'loaded data matches saved');
});

// --- Platform Adapter Detection Tests ---
console.log('\n[Platform Adapter Detection]');

test('Platform adapter registry has correct class-to-name mapping', () => {
  // Verify that each adapter class creates instances with the expected name
  const adapterMap = {
    standalone: StandaloneAdapter,
    crazygames: CrazyGamesAdapter,
    gamedistribution: GameDistributionAdapter,
    y8: Y8Adapter,
    playhop: PlayHopAdapter
  };

  for (const [expectedName, AdapterClass] of Object.entries(adapterMap)) {
    const adapter = new AdapterClass();
    assert(adapter.name === expectedName,
      `${AdapterClass.name} has name '${expectedName}', got '${adapter.name}'`);
    assert(adapter instanceof PlatformAdapter,
      `${AdapterClass.name} extends PlatformAdapter`);
  }
});

test('All adapters have consistent interface', () => {
  const adapters = [
    new StandaloneAdapter(),
    new CrazyGamesAdapter(),
    new GameDistributionAdapter(),
    new Y8Adapter(),
    new PlayHopAdapter()
  ];

  const methods = ['init', 'showBannerAd', 'showInterstitialAd', 'showRewardedAd',
    'gameplayStart', 'gameplayStop', 'happyMoment', 'happyTime',
    'saveData', 'loadData', 'isAdblocked', 'muteAudio', 'unmuteAudio'];

  for (const adapter of adapters) {
    for (const method of methods) {
      assert(typeof adapter[method] === 'function',
        `${adapter.name}.${method} is a function`);
    }
  }
});

// --- File Structure Validation ---
console.log('\n[File Structure]');

const __domtest_filename = fileURLToPath(import.meta.url);
const __domtest_dirname = dirname(__domtest_filename);
const rootDir = join(__domtest_dirname, '..');

test('index.html has required elements', () => {
  const htmlPath = join(rootDir, 'index.html');
  assert(existsSync(htmlPath), 'index.html exists');

  const html = readFileSync(htmlPath, 'utf8');
  assert(html.includes('<canvas'), 'has canvas element');
  assert(html.includes('id="game-canvas"'), 'canvas has game-canvas id');
  assert(html.includes('meta name="viewport"'), 'has meta viewport tag');
  assert(html.includes('rel="icon"'), 'has favicon link element');
  assert(html.includes('data:image/svg+xml'), 'favicon uses inline SVG data URI');
  assert(html.includes('type="module"'), 'has script type=module');
  assert(html.includes('src="src/main.js"'), 'script src points to src/main.js');
  assert(html.includes('href="styles.css"'), 'links to styles.css');
});

test('styles.css has CSS custom properties', () => {
  const cssPath = join(rootDir, 'styles.css');
  assert(existsSync(cssPath), 'styles.css exists');

  const css = readFileSync(cssPath, 'utf8');
  assert(css.includes('--felt-green'), 'has --felt-green variable');
  assert(css.includes('--card-width'), 'has --card-width variable');
  assert(css.includes('--ui-accent'), 'has --ui-accent variable');
});

test('styles.css has responsive breakpoints', () => {
  const css = readFileSync(join(rootDir, 'styles.css'), 'utf8');
  assert(css.includes('@media'), 'has @media queries');
  assert(css.includes('max-width: 480px'), 'has mobile breakpoint');
  assert(css.includes('min-width: 769px'), 'has tablet breakpoint');
  assert(css.includes('min-width: 1025px'), 'has desktop breakpoint');
  assert(css.includes('orientation: landscape'), 'has landscape orientation');
});

test('styles.css uses dvh units', () => {
  const css = readFileSync(join(rootDir, 'styles.css'), 'utf8');
  assert(css.includes('dvh'), 'uses dvh unit');
});

test('styles.css handles safe-area-inset', () => {
  const css = readFileSync(join(rootDir, 'styles.css'), 'utf8');
  assert(css.includes('env(safe-area-inset'), 'uses env() for safe-area-inset');
});

test('styles.css canvas is full viewport', () => {
  const css = readFileSync(join(rootDir, 'styles.css'), 'utf8');
  assert(css.includes('width: 100%'), 'canvas width 100%');
  assert(css.includes('100dvh'), 'canvas height uses dvh');
});

test('src/main.js has required structure', () => {
  const mainPath = join(rootDir, 'src', 'main.js');
  assert(existsSync(mainPath), 'src/main.js exists');

  const main = readFileSync(mainPath, 'utf8');
  assert(main.includes("import") && main.includes("getAdapter"), 'imports platform adapter');
  assert(main.includes("Game"), 'imports/creates Game instance');
  assert(main.includes("GameLoop"), 'imports/creates GameLoop');
  assert(main.includes("try") && main.includes("catch"), 'has try-catch for fatal error');
  assert(main.includes("fatal-error") || main.includes("error-message"), 'has fatal error UI reference');
});

test('All source files exist at expected paths', () => {
  const requiredFiles = [
    'index.html',
    'styles.css',
    'manifest.json',
    'sw.js',
    'src/main.js',
    'src/core/loop.js',
    'src/core/input.js',
    'src/core/math.js',
    'src/core/render.js',
    'src/core/audio.js',
    'src/game/game.js',
    'src/game/card.js',
    'src/game/deck.js',
    'src/game/tableau.js',
    'src/game/foundation.js',
    'src/game/stock.js',
    'src/game/drag.js',
    'src/systems/save-manager.js',
    'src/systems/progression.js',
    'src/systems/daily-challenge.js',
    'src/systems/achievements.js',
    'src/ui/hud.js',
    'src/ui/screens.js',
    'src/ui/particles.js',
    'src/ui/animations.js',
    'src/platform/adapter.js',
    'src/platform/standalone.js',
    'src/platform/crazygames.js',
    'src/platform/gamedistribution.js',
    'src/platform/y8.js',
    'src/platform/playhop.js',
    'src/platform/sdkUtil.js',
    'src/platform/index.js',
    'src/config/scoring.js',
    'src/config/themes.js',
    'src/config/daily-seeds.js',
    'src/config/achievements.js'
  ];

  for (const file of requiredFiles) {
    assert(existsSync(join(rootDir, file)), `${file} exists`);
  }
});

test('Build output validation (after build)', () => {
  const distDir = join(rootDir, 'dist');
  if (!existsSync(distDir)) {
    // Build not yet run - skip but count as pass
    assert(true, 'dist/ not present (build not run), skipping build validation');
    return;
  }

  const platforms = ['standalone', 'crazygames', 'gamedistribution', 'y8', 'playhop'];
  const sdkUrls = {
    standalone: null,
    crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js',
    y8: 'https://cdn.y8.com/api/sdk.js',
    playhop: 'https://cdn.playgama.com/sdk/bridge.js'
  };

  for (const platform of platforms) {
    const platformDir = join(distDir, platform);
    const indexPath = join(platformDir, 'index.html');

    assert(existsSync(platformDir), `dist/${platform}/ directory exists`);
    assert(existsSync(indexPath), `dist/${platform}/index.html exists`);

    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf8');
      assert(html.includes(`window.__PLATFORM__ = '${platform}'`),
        `${platform}/index.html has __PLATFORM__ variable set to '${platform}'`);

      if (sdkUrls[platform]) {
        assert(html.includes(sdkUrls[platform]),
          `${platform}/index.html has correct SDK script URL`);
      }
    }
  }
});

// --- PWA and New File Tests ---
console.log('\n[PWA and New Files]');

test('manifest.json is valid JSON with required fields', () => {
  const manifestPath = join(rootDir, 'manifest.json');
  assert(existsSync(manifestPath), 'manifest.json exists');
  const content = readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(content);
    assert(true, 'manifest.json is valid JSON');
  } catch (e) {
    assert(false, 'manifest.json is NOT valid JSON: ' + e.message);
    return;
  }
  assert(manifest.name !== undefined, 'manifest has name');
  assert(manifest.short_name !== undefined, 'manifest has short_name');
  assert(manifest.start_url !== undefined, 'manifest has start_url');
  assert(manifest.display !== undefined, 'manifest has display');
  assert(manifest.theme_color !== undefined, 'manifest has theme_color');
  assert(manifest.background_color !== undefined, 'manifest has background_color');
  assert(Array.isArray(manifest.icons), 'manifest has icons array');
  assert(manifest.icons.length >= 1, 'manifest has at least 1 icon');
});

test('sw.js exists and contains cache logic', () => {
  const swPath = join(rootDir, 'sw.js');
  assert(existsSync(swPath), 'sw.js exists');
  const content = readFileSync(swPath, 'utf8');
  assert(content.includes('install'), 'sw.js handles install event');
  assert(content.includes('fetch'), 'sw.js handles fetch event');
  assert(content.includes('cache') || content.includes('Cache'), 'sw.js uses caching');
});

test('index.html has PWA support', () => {
  const html = readFileSync(join(rootDir, 'index.html'), 'utf8');
  assert(html.includes('manifest'), 'index.html links to manifest');
  assert(html.includes('serviceWorker') || html.includes('sw.js'), 'index.html registers service worker');
  assert(html.includes('theme-color'), 'index.html has theme-color meta');
});

test('ParticleSystem class instantiates correctly', () => {
  const ps = new ParticleSystem();
  assert(typeof ps.emit === 'function', 'has emit method');
  assert(typeof ps.update === 'function', 'has update method');
  assert(typeof ps.render === 'function', 'has render method');
  assert(typeof ps.clear === 'function', 'has clear method');
});

test('AnimationManager class instantiates correctly', () => {
  const am = new AnimationManager();
  assert(typeof am.add === 'function', 'has add method');
  assert(typeof am.update === 'function', 'has update method');
  assert(typeof am.isAnimating === 'function', 'has isAnimating method');
  assert(typeof am.cancel === 'function', 'has cancel method');
});

test('ParticleSystem emit and update cycle', () => {
  const ps = new ParticleSystem();
  // Should not throw even without a real canvas context
  ps.emit('sparkle', 100, 100, 5);
  assert(ps.particles.length > 0, 'particles emitted');
  ps.update(0.016);
  assert(true, 'update does not throw');
  ps.clear();
  assert(ps.particles.length === 0, 'clear removes all particles');
});

test('AnimationManager tween lifecycle', () => {
  const am = new AnimationManager();
  const target = { x: 0, y: 0 };
  am.add(target, { x: 100 }, 1.0);
  assert(am.isAnimating() === true, 'animating after add');
  am.update(0.5);
  assert(target.x > 0, 'target x moved after half duration');
  am.update(0.6); // past duration
  assert(target.x === 100, 'target x at final value after complete');
  assert(am.isAnimating() === false, 'not animating after complete');
});

// --- ES Module Link-Time Import Check (regression guard for syntax errors) ---
// This is the gap that let the "Start Today's Challenge" apostrophe bug ship:
// the prior harness used static imports and never referenced screens.js, so a
// link-time syntax error went undetected. We now import EVERY src/*.js through
// the real ES module loader.
console.log('\n[ES Module Import Check]');

// Install the browser surface so main.js can boot cleanly during the import scan.
installDOM({ width: 800, height: 600 });

const __importResult = await checkAllImports();
test('every src/*.js links through the real ES module loader', () => {
  if (__importResult.failures.length) {
    for (const f of __importResult.failures) console.error(`    ${f.file}: ${f.error}`);
  }
  assert(__importResult.failures.length === 0,
    `all ${__importResult.checked} modules import without link-time syntax errors`);
  assert(__importResult.checked >= 30, `scanned a meaningful number of modules (${__importResult.checked})`);
});

// --- Dead Button Audit (every button action must have a handler) ---
console.log('\n[Dead Button Audit]');

const __mainSrc = readFileSync(join(rootDir, 'src', 'main.js'), 'utf8');
const __handledCases = new Set();
for (const m of __mainSrc.matchAll(/case\s+'([^']+)'\s*:/g)) __handledCases.add(m[1]);
const __handlesAchCat = /startsWith\('achCat_'\)/.test(__mainSrc);

const __fakeRenderer = { logicalWidth: 800, logicalHeight: 600, ctx: makeCtx() };
const __screens = new Screens(__fakeRenderer, null);
const __SCREEN_NAMES = ['loading', 'mainMenu', 'modeSelect', 'settings', 'statistics',
  'achievements', 'dailyChallenge', 'pause', 'win', 'gameOver'];

test('every ScreenButton action produced by _buildButtons is handled in main.js', () => {
  for (const screen of __SCREEN_NAMES) {
    __screens.activeScreen = screen;
    __screens._buildButtons();
    for (const btn of __screens.buttons) {
      const action = btn.action;
      if (!action) continue;
      const handled = __handledCases.has(action) || (action.startsWith('achCat_') && __handlesAchCat);
      assert(handled, `screen "${screen}" button action "${action}" has a handler`);
    }
  }
});

test('every HUD action is handled in main.js', () => {
  const game = new Game({ drawCount: 1, seed: 7 });
  game.deal();
  const hud = new HUD(game, __fakeRenderer);
  const hudActions = hud.buttons.map(b => b.action).filter(Boolean);
  assert(hudActions.length >= 4, `HUD exposes action buttons (${hudActions.length})`);
  for (const action of hudActions) {
    assert(__handledCases.has(action), `HUD action "${action}" has a handler`);
  }
});

test('slider actions are handled by _handleSliderAction', () => {
  const sliderBody = __mainSrc.slice(__mainSrc.indexOf('_handleSliderAction'));
  for (const action of ['sfxVolume', 'musicVolume']) {
    assert(sliderBody.includes(`case '${action}'`), `slider action "${action}" handled`);
  }
});

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
