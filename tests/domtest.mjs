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
import { SaveManager } from '../src/systems/save-manager.js';
import { Progression } from '../src/systems/progression.js';
import { DailyChallenge } from '../src/systems/daily-challenge.js';
import { Achievements } from '../src/systems/achievements.js';

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

test('Achievements stub works', () => {
  const achievements = new Achievements();
  assert(achievements.getUnlocked().length === 0, 'no achievements initially');
  assert(achievements.isUnlocked('test') === false, 'test not unlocked');
});

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
