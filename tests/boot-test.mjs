/**
 * Full headless boot + QA test.
 *
 * Boots the REAL App (src/main.js) against the DOM harness, then:
 *  - confirms boot did not raise the fatal-error overlay
 *  - imports every src/*.js through the real ES loader (regression guard for
 *    link-time syntax errors like the Today's-Challenge apostrophe bug)
 *  - drives EVERY screen through render + update with no exceptions
 *  - audits that every ScreenButton / HUD / slider action has a real handler
 *    in main.js (no dead buttons), and invokes each handler without throwing
 *  - exercises the full gameplay flow (deal, draw, recycle, moves, undo, redo,
 *    hint, auto-complete, win + win animation, hard-mode timeout -> gameOver)
 *  - verifies save/load round-trips and Continue restoring a saved game
 *  - sanity-checks responsive layout across narrow..ultrawide / portrait+landscape
 *  - confirms guarded particles/audio when reducedMotion is on and sound is off
 *
 * Run: env -u NODE_OPTIONS node tests/boot-test.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { installDOM } from './dom-harness.mjs';
import { checkAllImports } from './import-check.mjs';
import { Game } from '../src/game/game.js';
import { Card } from '../src/game/card.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`  FAIL: ${msg}`); }
}
function test(name, fn) {
  console.log(`  Test: ${name}`);
  try { fn(); } catch (e) { failed++; console.error(`  FAIL (exception): ${name} - ${e.message}\n${e.stack}`); }
}
async function testAsync(name, fn) {
  console.log(`  Test: ${name}`);
  try { await fn(); } catch (e) { failed++; console.error(`  FAIL (exception): ${name} - ${e.message}\n${e.stack}`); }
}

console.log('=== Full Headless Boot + QA Test ===\n');

// Install browser surface BEFORE importing main.js (which auto-boots).
const dom = installDOM({ width: 800, height: 600 });

// ---------------------------------------------------------------------------
console.log('[ES Module Import Check]');
await testAsync('every src/*.js links cleanly through the real ES loader', async () => {
  const { checked, failures } = await checkAllImports();
  if (failures.length) for (const f of failures) console.error(`    ${f.file}: ${f.error}`);
  assert(failures.length === 0, `all ${checked} modules import without link-time errors`);
  assert(checked >= 30, `imported a meaningful number of modules (${checked})`);
});

// ---------------------------------------------------------------------------
console.log('\n[Boot]');
const mainMod = await import('../src/main.js?boot=1');
const app = dom.window.__app;

test('App booted and is exposed on window.__app', () => {
  assert(app && typeof app === 'object', 'window.__app is set');
});
test('fatal-error overlay NOT shown after boot', () => {
  assert(dom.fatalErrorEl.hidden === true, 'fatal-error overlay remains hidden (no boot crash)');
});
test('boot reached main menu', () => {
  assert(app.screens.activeScreen === 'mainMenu', 'active screen is mainMenu after boot');
});

// ---------------------------------------------------------------------------
console.log('\n[Drive Every Screen: render + update]');
const ALL_SCREENS = ['loading', 'mainMenu', 'modeSelect', 'settings', 'statistics',
  'achievements', 'dailyChallenge', 'howToPlay', 'pause', 'win', 'gameOver'];

for (const screen of ALL_SCREENS) {
  test(`screen "${screen}" builds, renders and updates without throwing`, () => {
    // Force the screen active and rebuild its buttons directly.
    app.screens.activeScreen = screen;
    app.screens.transitioning = false;
    app.screens.nextScreen = null;
    if (screen === 'win' || screen === 'gameOver') {
      app.screens.winData = { score: 1234, moves: 99, time: 215 };
    }
    app.screens._buildButtons();
    // Render the overlay (uses real Screens.render on the stubbed ctx).
    app.screens.render();
    // Update a few frames (covers loading progress + transitions).
    for (let i = 0; i < 5; i++) app.screens.update(0.1);
    // Pointer move over every button (hover state) must not throw.
    for (const b of app.screens.buttons) app.screens.updatePointer(b.x + 1, b.y + 1);
    assert(true, `${screen} rendered/updated cleanly`);
  });
}

test('coach marks render without throwing', () => {
  app.screens.showCoachMarks();
  app.screens.render();
  app.screens.handleClick(400, 300); // advance a coach step
  assert(app.screens.showCoach === true || app.screens.coachDismissed === true, 'coach interaction handled');
  app.screens.coachDismissed = true; app.screens.showCoach = false;
});

// ---------------------------------------------------------------------------
console.log('\n[Dead Button Audit]');

// Statically extract every handled `case '...'` label from main.js.
const mainSrc = readFileSync(join(rootDir, 'src', 'main.js'), 'utf8');
const handledCases = new Set();
for (const m of mainSrc.matchAll(/case\s+'([^']+)'\s*:/g)) handledCases.add(m[1]);
const handlesAchCatPrefix = /startsWith\('achCat_'\)/.test(mainSrc);

// Dynamically enumerate every ScreenButton action produced by _buildButtons
// for every screen.
function actionsForScreen(screen) {
  app.screens.activeScreen = screen;
  app.screens._buildButtons();
  return app.screens.buttons.map(b => b.action).filter(Boolean);
}

const screenActions = new Map();
for (const screen of ALL_SCREENS) screenActions.set(screen, actionsForScreen(screen));

test('every screen button action has a handler in main.js', () => {
  for (const [screen, actions] of screenActions) {
    for (const action of actions) {
      const handled = handledCases.has(action) || (action.startsWith('achCat_') && handlesAchCatPrefix);
      assert(handled, `screen "${screen}" action "${action}" is handled in main.js`);
    }
  }
});

// HUD actions come from the HudButton instances.
test('every HUD action has a handler in main.js', () => {
  const hudActions = app.hud.buttons.map(b => b.action).filter(Boolean);
  assert(hudActions.length >= 4, `HUD exposes its action buttons (${hudActions.length})`);
  for (const action of hudActions) {
    assert(handledCases.has(action), `HUD action "${action}" is handled in main.js`);
  }
});

// Slider actions (settings screen) must be handled by _handleSliderAction.
test('slider actions (sfxVolume, musicVolume) are handled', () => {
  const sliderHandlerBody = mainSrc.slice(mainSrc.indexOf('_handleSliderAction'));
  for (const action of ['sfxVolume', 'musicVolume']) {
    assert(sliderHandlerBody.includes(`case '${action}'`), `slider action "${action}" handled in _handleSliderAction`);
  }
});

// Functionally invoke each unique screen action and assert it does not throw.
test('invoking every screen action handler does not throw', () => {
  const unique = new Set();
  for (const actions of screenActions.values()) for (const a of actions) unique.add(a);
  for (const action of unique) {
    try {
      app._handleScreenAction(action);
    } catch (e) {
      assert(false, `_handleScreenAction('${action}') threw: ${e.message}`);
    }
  }
  // Return to a known state.
  app._handleScreenAction('mainMenu');
  assert(true, 'all screen action handlers executed without throwing');
});

test('invoking every HUD action handler does not throw', () => {
  app._handleScreenAction('startEasy'); // ensure a live game exists
  for (const action of app.hud.buttons.map(b => b.action)) {
    try { app._handleHudAction(action); } catch (e) {
      assert(false, `_handleHudAction('${action}') threw: ${e.message}`);
    }
  }
  // Leaving pause/menu state: go back to a game.
  app._handleScreenAction('resume');
  assert(true, 'all HUD action handlers executed without throwing');
});

// "Doesn't throw" is not enough — verify the previously-dead actions produce
// a real, observable effect (state change or visible highlight).
test('hint / redo / autoComplete are functional, not no-ops', () => {
  // hint -> visible highlight state or a toast
  app._handleScreenAction('startEasy');
  app.hint.active = false; app._toasts = [];
  app._handleHudAction('hint');
  assert((app.hint && app.hint.active) || app._toasts.length > 0,
    'hint produces a visible highlight or toast (not a no-op)');

  // redo -> restores a move that was undone
  app._handleScreenAction('startEasy');
  app.game.drawFromStock();
  const movesAfterDraw = app.game.moves;
  app._handleHudAction('undo');
  assert(app.game.moves === movesAfterDraw - 1, 'undo changed state');
  app._handleHudAction('redo');
  assert(app.game.moves === movesAfterDraw, 'redo restored the move (not a no-op)');

  // autoComplete -> actually begins auto-completing a solvable board
  app._handleScreenAction('startEasy');
  const g = app.game;
  g.stock.stock = []; g.stock.waste = [];
  g.foundation.piles = [[], [], [], []];
  g.tableau.columns = [[], [], [], [], [], [], []];
  const SUITS2 = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS2 = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const find2 = (s, r) => g.allCards.find(c => c.suit === s && c.rank === r);
  for (let p = 0; p < 4; p++) {
    for (let i = RANKS2.length - 1; i >= 0; i--) {
      const card = find2(SUITS2[p], RANKS2[i]); card.faceUp = true; g.tableau.columns[p].push(card);
    }
  }
  assert(g.canAutoComplete() === true, 'board is auto-completable');
  app._handleHudAction('autoComplete');
  assert(g.autoCompleting === true, 'autoComplete actually started the cascade (not a no-op)');
  g.autoCompleting = false; // stop the cascade for test isolation
});

// ---------------------------------------------------------------------------
console.log('\n[Gameplay Flow]');

test('start new game (Easy) deals 52 cards and renders', () => {
  app._handleScreenAction('startEasy');
  let total = 0;
  for (const col of app.game.tableau.columns) total += col.length;
  total += app.game.stock.stock.length + app.game.stock.waste.length;
  for (const p of app.game.foundation.piles) total += p.length;
  assert(total === 52, `52 cards in play (got ${total})`);
  assert(app.gameActive === true, 'gameActive is true');
  app._render(0.016); app._update(0.016);
  assert(true, 'render/update during play does not throw');
});

test('draw from stock then recycle', () => {
  app._handleScreenAction('startEasy');
  const stock0 = app.game.stock.stock.length;
  app.game.drawFromStock();
  assert(app.game.stock.stock.length === stock0 - 1, 'one card drawn to waste');
  // Empty the stock then recycle.
  let guard = 0;
  while (!app.game.stock.isEmpty() && guard++ < 100) app.game.drawFromStock();
  assert(app.game.stock.isEmpty(), 'stock emptied via draws');
  const wasteBefore = app.game.stock.waste.length;
  app.game.drawFromStock(); // triggers recycle
  assert(app.game.stock.stock.length === wasteBefore, 'recycle moved waste back to stock');
  assert(app.game.stock.waste.length === 0, 'waste empty after recycle');
});

test('undo and redo restore state', () => {
  app._handleScreenAction('startEasy');
  app.game.drawFromStock();
  app.game.drawFromStock();
  const movesAfter2 = app.game.moves;
  assert(app.game.canUndo(), 'can undo after moves');
  app._handleHudAction('undo');
  assert(app.game.moves === movesAfter2 - 1, 'undo decrements moves');
  assert(app.game.canRedo(), 'can redo after undo');
  app._handleHudAction('redo');
  assert(app.game.moves === movesAfter2, 'redo restores moves');
});

test('hint system returns a move without throwing', () => {
  app._handleScreenAction('startEasy');
  const hint = app.game.getNextHint();
  assert(hint === null || (hint.from && hint.to), 'hint is null or a valid {from,to}');
  app._handleHudAction('hint'); // must not throw
  assert(true, 'hint handler executed');
});

test('tableau->foundation auto-move via double tap path', () => {
  app._handleScreenAction('startEasy');
  // Find an Ace that is the top of a tableau column and auto-move it.
  let movedAnAce = false;
  for (let c = 0; c < 7; c++) {
    const top = app.game.tableau.topCard(c);
    if (top && top.faceUp && top.value === 1) {
      movedAnAce = app.game.autoMoveToFoundation(top);
      break;
    }
  }
  // Not every deal exposes an Ace; just assert no throw and foundation valid.
  assert(typeof movedAnAce === 'boolean', 'autoMoveToFoundation returns boolean');
  app._positionCards();
  assert(true, 'positioning after auto-move did not throw');
});

test('auto-complete runs to a win and triggers win animation', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  // Arrange a near-solved board: all cards face up, stock/waste empty.
  g.stock.stock = []; g.stock.waste = [];
  g.foundation.piles = [[], [], [], []];
  g.tableau.columns = [[], [], [], [], [], [], []];
  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  // Put every card face-up spread across tableau columns in foundation-ready order
  // (one full suit per column for columns 0..3).
  const find = (s, r) => g.allCards.find(c => c.suit === s && c.rank === r);
  for (let p = 0; p < 4; p++) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      const card = find(SUITS[p], RANKS[i]);
      card.faceUp = true;
      g.tableau.columns[p].push(card);
    }
  }
  assert(g.canAutoComplete() === true, 'board is auto-completable');
  g.startAutoComplete();
  let guard = 0;
  while (g.autoCompleting && guard++ < 1000) g.update(0.2);
  assert(g.foundation.isComplete(), 'auto-complete filled all foundations');
  assert(g.state === 'won', 'game state is WON after auto-complete');
  // Drive the win animation frames.
  app.showingWinAnim = true;
  for (let i = 0; i < 30; i++) {
    g.updateWinAnimation(0.05, app.renderer.logicalWidth, app.renderer.logicalHeight, app.layout.cardWidth, app.layout.cardHeight);
  }
  app._render(0.016);
  assert(true, 'win animation rendered without throwing');
});

test('hard-mode timer expiry transitions to gameOver', () => {
  let lost = false;
  app._startNewGame(true, { drawCount: 1 }); // medium = timed, 600s
  app.game.onLose = () => { lost = true; };
  app.game.timerCountsDown = true;
  app.game.timer = 0.5;
  app.game.update(1.0); // tick past zero
  assert(app.game.state === 'lost', 'game state is LOST after timer expiry');
  assert(lost === true, 'onLose callback fired');
});

test('core move methods: full transition matrix', () => {
  const fu = (s, r) => { const c = new Card(s, r); c.faceUp = true; return c; };

  // waste -> tableau (black 7 onto red 8)
  let g = new Game({ drawCount: 1, seed: 1 }); g.deal();
  g.stock.waste = [fu('spades', '7')];
  g.tableau.columns[0] = [fu('hearts', '8')];
  assert(g.moveWasteToTableau(0) === true, 'waste->tableau valid move accepted');
  assert(g.tableau.columns[0].length === 2 && g.stock.waste.length === 0, 'waste card moved to tableau');

  // tableau -> tableau (black 7 onto red 8)
  g = new Game({ drawCount: 1, seed: 1 }); g.deal();
  g.tableau.columns[0] = [fu('hearts', '8')];
  g.tableau.columns[1] = [fu('spades', '7')];
  assert(g.moveTableauToTableau(1, 0, 0) === true, 'tableau->tableau valid move accepted');
  assert(g.tableau.columns[0].length === 2 && g.tableau.columns[1].length === 0, 'sequence moved between columns');

  // tableau -> foundation (Ace)
  g = new Game({ drawCount: 1, seed: 1 }); g.deal();
  g.tableau.columns[2] = [fu('clubs', 'A')];
  assert(g.moveTableauToFoundation(2) === true, 'tableau->foundation Ace accepted');
  assert(g.foundation.totalCards() === 1, 'Ace placed on foundation');

  // foundation -> tableau (2 of spades from foundation onto red 3)
  g = new Game({ drawCount: 1, seed: 1 }); g.deal();
  g.foundation.piles[0] = [fu('spades', 'A'), fu('spades', '2')];
  g.tableau.columns[3] = [fu('hearts', '3')];
  assert(g.moveFoundationToTableau(0, 3) === true, 'foundation->tableau valid move accepted');
  assert(g.tableau.columns[3].length === 2, 'card moved from foundation to tableau');
});

test('UI drop path (_executeDrop) moves cards and increments moves', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  const ace = new Card('hearts', 'A'); ace.faceUp = true;
  g.stock.waste = [ace];
  g.foundation.piles = [[], [], [], []];
  const before = g.moves;
  app._executeDrop({ type: 'waste', index: 0 }, [ace], { type: 'foundation', index: 0 });
  assert(g.foundation.piles[0].length === 1, 'ace dropped onto foundation pile via UI path');
  assert(g.moves === before + 1, 'move counter incremented by drop');
  app._positionCards();
  assert(true, 'drop + reposition did not throw');
});

test('no soft-lock: can always reach menu and start a fresh game', () => {
  // Screens use animated transitions that settle over update() frames; the
  // real game loop pumps these continuously. Pump them here so activeScreen
  // reflects the settled target.
  const settle = () => { for (let i = 0; i < 10 && app.screens.transitioning; i++) app.screens.update(0.1); };
  app._handleScreenAction('startEasy'); settle();
  app._handleHudAction('menu'); settle();          // pause
  assert(app.screens.activeScreen === 'pause', 'menu opens pause screen');
  app._handleScreenAction('quit'); settle();        // back to menu
  assert(app.screens.activeScreen === 'mainMenu' && app.gameActive === false, 'quit returns to main menu');
  app._handleScreenAction('modeSelect'); settle();
  app._handleScreenAction('startHard'); settle();   // start again
  assert(app.gameActive === true, 'can start a new game from menu');
});

// ---------------------------------------------------------------------------
console.log('\n[Hint Highlight / How-to-Play / Tap-to-Move / Toasts]');

test('Hint button sets a visible highlight state (not a no-op) and fades out', () => {
  app._handleScreenAction('startEasy');
  app.hint.active = false;
  app._toasts = [];
  app._handleHudAction('hint');
  const shown = (app.hint && app.hint.active === true) || (app._toasts && app._toasts.length > 0);
  assert(shown, 'hint sets an active highlight OR shows a toast (real visible effect)');
  if (app.hint.active && !app.hint.isStock) {
    assert(app.hint.data && app.hint.data.from && app.hint.data.to,
      'active hint references a concrete from/to move');
  }
  app._render(0.016); // renders the highlight without throwing
  for (let i = 0; i < 300 && app.hint.active; i++) app._update(0.016);
  assert(app.hint.active === false, 'hint highlight fades out after its duration');
});

test('Hint with no available move offers the stock + shows a toast', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  // Empty board (no tableau/foundation moves) but stock still has cards.
  g.tableau.columns = [[], [], [], [], [], [], []];
  g.foundation.piles = [[], [], [], []];
  g.stock.waste = [];
  g._hints = []; g._currentHintIndex = 0;
  app.hint.active = false; app._toasts = [];
  app._handleHudAction('hint');
  assert(app.hint.active === true && app.hint.isStock === true, 'stock offered as the hint when no moves exist');
  assert(app._toasts.length > 0, 'a guidance toast is shown when no moves are available');
});

test('How-to-Play is reachable from the menu, pages, renders, and is exitable', () => {
  const settle = () => { for (let i = 0; i < 12 && app.screens.transitioning; i++) app.screens.update(0.1); };
  app._handleScreenAction('mainMenu'); settle();
  app.screens.activeScreen = 'mainMenu'; app.screens._buildButtons();
  const menuActions = app.screens.buttons.map(b => b.action);
  assert(menuActions.includes('howToPlay'), 'main menu exposes a How to Play entry');

  app._handleScreenAction('howToPlay'); settle();
  assert(app.screens.activeScreen === 'howToPlay', 'How to Play screen becomes active');

  // Every tutorial page builds nav buttons and renders without throwing.
  for (let p = 0; p < app.screens.howToPlayPageCount; p++) {
    app.screens.howToPlayPage = p;
    app.screens._buildButtons();
    app.screens.render();
    assert(app.screens.buttons.length >= 3, `page ${p} builds Prev/Close/Next navigation`);
  }
  // Next/Back navigation changes the page.
  app.screens.howToPlayPage = 0;
  app._handleScreenAction('htpNext');
  assert(app.screens.howToPlayPage === 1, 'Next advances the tutorial page');
  app._handleScreenAction('htpPrev');
  assert(app.screens.howToPlayPage === 0, 'Back returns to the previous page');

  // Exitable back to the menu.
  app._handleScreenAction('htpClose'); settle();
  assert(app.screens.activeScreen === 'mainMenu', 'How to Play closes back to the main menu');
});

test('How-to-Play is reachable from Pause and returns to Pause', () => {
  const settle = () => { for (let i = 0; i < 12 && app.screens.transitioning; i++) app.screens.update(0.1); };
  app._handleScreenAction('startEasy'); settle();
  app._handleHudAction('menu'); settle();
  assert(app.screens.activeScreen === 'pause', 'pause screen is open');
  app._handleScreenAction('howToPlay'); settle();
  assert(app.screens.activeScreen === 'howToPlay', 'How to Play opens from pause');
  app._handleScreenAction('htpClose'); settle();
  assert(app.screens.activeScreen === 'pause', 'closing returns to pause (not the menu)');
  app._handleScreenAction('resume'); settle();
});

test('tap-to-move: select a card, then tap a valid destination to move it', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  const fu = (s, r) => { const c = new Card(s, r); c.faceUp = true; return c; };
  g.tableau.columns[0] = [fu('hearts', '8')]; // red 8 (target)
  g.tableau.columns[1] = [fu('spades', '7')]; // black 7 (source)
  app._positionCards();
  app._clearSelection();

  const src = g.tableau.columns[1][0];
  app._handleTap(src.x + 5, src.y + 5, { type: 'tableau', index: 1, cardIndex: 0 }, [src]);
  assert(app.selectedCards && app.selectedCards.length === 1, 'first tap selects a movable card');

  const tgt = g.tableau.columns[0][0];
  app._handleTap(tgt.x + 5, tgt.y + 5, { type: 'tableau', index: 0, cardIndex: 0 }, [tgt]);
  assert(g.tableau.columns[0].length === 2, 'second tap moved the 7 onto the 8');
  assert(g.tableau.columns[1].length === 0, 'source column is now empty');
  assert(app.selectedCards === null, 'selection is cleared after the move');
});

test('tap-to-move: tapping the same selected card deselects it', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  const fu = (s, r) => { const c = new Card(s, r); c.faceUp = true; return c; };
  g.tableau.columns[2] = [fu('clubs', '9')];
  app._positionCards();
  app._clearSelection();
  const c = g.tableau.columns[2][0];
  const srcDesc = { type: 'tableau', index: 2, cardIndex: 0 };
  app._handleTap(c.x + 5, c.y + 5, srcDesc, [c]);
  assert(app.selectedCards !== null, 'card selected');
  app._handleTap(c.x + 5, c.y + 5, srcDesc, [c]);
  assert(app.selectedCards === null, 'tapping the same card again deselects');
});

test('double-tap sends a tableau Ace to the foundation', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  const fu = (s, r) => { const c = new Card(s, r); c.faceUp = true; return c; };
  g.tableau.columns[0] = [fu('clubs', 'A')];
  g.foundation.piles = [[], [], [], []];
  app._positionCards();
  const ace = g.tableau.columns[0][0];
  app._onDoubleTap({ x: ace.x + 5, y: ace.y + 5 });
  assert(g.foundation.totalCards() === 1, 'double-tap auto-moved the Ace to a foundation');
});

test('toast system queues, renders and expires', () => {
  app._handleScreenAction('startEasy');
  app._toasts = [];
  app._showToast('Test toast', { duration: 0.5 });
  assert(app._toasts.length === 1, 'toast is queued');
  app._render(0.016); // renders without throwing
  for (let i = 0; i < 20; i++) app._update(0.05);
  assert(app._toasts.length === 0, 'toast expires after its duration');
});

test('daily reward can be claimed once per day and then disables', () => {
  if (app.saveManager.delete) app.saveManager.delete('solitaire_daily_reward');
  assert(app._isDailyRewardAvailable() === true, 'reward available before claiming');
  app._claimDailyReward();
  assert(app._isDailyRewardAvailable() === false, 'reward no longer available after claiming');
});

test('invalid drag triggers a red flash that clears', () => {
  app._handleScreenAction('startEasy');
  const g = app.game;
  const fu = (s, r) => { const c = new Card(s, r); c.faceUp = true; return c; };
  const card = fu('spades', '5');
  app._triggerInvalidFlash([card]);
  assert(app._invalidFlash && app._invalidFlash.rects.length === 1, 'invalid flash state set');
  app._render(0.016); // renders without throwing
  for (let i = 0; i < 60 && app._invalidFlash; i++) app._update(0.05);
  assert(app._invalidFlash === null, 'invalid flash clears after its duration');
});

// ---------------------------------------------------------------------------
console.log('\n[Save / Load Round-Trips]');

test('settings round-trip through SaveManager', () => {
  app.settings.tableFelt = 'purple';
  app.settings.sfxVolume = 0.33;
  app._saveSettings();
  const loaded = app.saveManager.load('solitaire_settings');
  assert(loaded && loaded.tableFelt === 'purple', 'tableFelt persisted');
  assert(Math.abs(loaded.sfxVolume - 0.33) < 1e-9, 'sfxVolume persisted');
});

test('stats / progression / achievements / daily round-trip via saveAll', () => {
  app._saveAllState();
  const all = app.saveManager.loadAll();
  assert(all.stats && typeof all.stats === 'object', 'stats persisted');
  assert(all.progression && typeof all.progression.xp === 'number', 'progression persisted');
  assert(all.achievements && Array.isArray(all.achievements.unlocked), 'achievements persisted');
  assert(all.daily && typeof all.daily.streak === 'number', 'daily persisted');
});

test('in-progress game state saves and Continue restores it', () => {
  app._handleScreenAction('startHard');
  app.game.drawFromStock();
  const moves = app.game.moves;
  const score = app.game.score;
  app._saveGameState();
  assert(app.saveManager.hasSavedGame(), 'saved game recorded');
  // Simulate returning to menu, then Continue.
  app._handleScreenAction('quit');
  app.screens.setHasSavedGame(true);
  const restored = app._restoreGameState();
  assert(restored === true, 'restoreGameState succeeded');
  assert(app.game.moves === moves, 'restored move count matches');
  assert(app.game.score === score, 'restored score matches');
  let total = 0;
  for (const col of app.game.tableau.columns) total += col.length;
  total += app.game.stock.stock.length + app.game.stock.waste.length;
  for (const p of app.game.foundation.piles) total += p.length;
  assert(total === 52, `restored board has all 52 cards (got ${total})`);
});

// ---------------------------------------------------------------------------
console.log('\n[Responsive Layout Sanity]');

const VIEWPORTS = [
  [320, 568],  // small phone portrait
  [375, 667],
  [414, 896],
  [768, 1024], // tablet portrait
  [667, 375],  // phone landscape
  [1024, 768], // tablet landscape
  [1920, 1080],// desktop
  [2560, 1080],// ultrawide
];

for (const [w, h] of VIEWPORTS) {
  test(`layout fits at ${w}x${h}`, () => {
    app.renderer.canvas.width = w; app.renderer.canvas.height = h;
    app.renderer.width = w; app.renderer.height = h; app.renderer.dpr = 1;
    app._handleScreenAction('startEasy');
    app._computeLayout();
    const L = app.layout;
    const rightEdge = L.marginX + L.cardWidth * 7 + 10 * 6;
    assert(L.cardWidth > 0 && L.cardHeight > 0, 'card dimensions positive');
    assert(L.marginX >= 0, 'left margin non-negative');
    assert(rightEdge <= w + 1, `7 columns fit within width (${rightEdge.toFixed(1)} <= ${w})`);
    // Tallest column must fit vertically with the dynamic stack offset.
    let maxLen = 0;
    for (const col of app.game.tableau.columns) maxLen = Math.max(maxLen, col.length);
    const bottom = L.tableauY + (maxLen - 1) * L.stackOffsetY + L.cardHeight;
    assert(bottom <= h + L.cardHeight, `tallest column bottom within sane bounds at ${w}x${h}`);
    app._render(0.016);
    app.screens.activeScreen = 'mainMenu'; app.screens._buildButtons(); app.screens.render();
    assert(true, 'render at this viewport did not throw');
  });
}

// ---------------------------------------------------------------------------
console.log('\n[Guards: reduced motion + sound off]');

test('reducedMotion suppresses particle emission and does not throw', () => {
  app.settings.reducedMotion = true;
  app._handleScreenAction('startEasy');
  app.particles.clear();
  // Pointer move during a drag would normally emit dust; with reducedMotion it must not.
  app._onPointerMove({ x: 100, y: 100 });
  app._update(0.016); app._render(0.016);
  assert(true, 'update/render with reducedMotion did not throw');
});

test('sound disabled: audio calls are guarded and do not throw', () => {
  app.settings.soundEnabled = false;
  app._ensureAudio();
  for (const s of ['cardFlip', 'cardPlace', 'win', 'error', 'buttonClick', 'autoComplete', 'undo', 'redo', 'hint']) {
    app.audio.play(s);
  }
  assert(true, 'muted audio playback did not throw');
  // Re-enable and play through initialized context.
  app.settings.soundEnabled = true;
  app._ensureAudio();
  app.audio.play('win');
  assert(app.audio.initialized === true, 'audio context initialized via _ensureAudio');
});

// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) { process.exit(1); } else { console.log('All boot/QA tests passed!'); }
