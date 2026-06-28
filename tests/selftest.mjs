/**
 * Self-test: headless logic tests for core game mechanics.
 * Run with: node tests/selftest.mjs
 */

import { Card, SUITS, RANKS, RANK_VALUES, isRed, isBlack } from '../src/game/card.js';
import { createDeck, shuffle, createSeededDeck } from '../src/game/deck.js';
import { Tableau } from '../src/game/tableau.js';
import { Foundation } from '../src/game/foundation.js';
import { Stock } from '../src/game/stock.js';
import { Game, GAME_STATES } from '../src/game/game.js';
import { createRng, lerp, clamp, easeOutQuad } from '../src/core/math.js';
import { xpForLevel, totalXpForLevel, levelFromXp, calculateGameXp } from '../src/systems/progression.js';
import { getDailySeed } from '../src/config/daily-seeds.js';

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

console.log('=== Klondike Solitaire Self-Test ===\n');

// --- Card Tests ---
console.log('[Card]');

test('Card creation', () => {
  const card = new Card('spades', 'A');
  assert(card.suit === 'spades', 'suit should be spades');
  assert(card.rank === 'A', 'rank should be A');
  assert(card.value === 1, 'value should be 1');
  assert(card.faceUp === false, 'should start face down');
});

test('Card color detection', () => {
  assert(isRed('hearts') === true, 'hearts is red');
  assert(isRed('diamonds') === true, 'diamonds is red');
  assert(isBlack('spades') === true, 'spades is black');
  assert(isBlack('clubs') === true, 'clubs is black');
  assert(isRed('spades') === false, 'spades is not red');
  assert(isBlack('hearts') === false, 'hearts is not black');
});

test('Card containsPoint', () => {
  const card = new Card('hearts', 'K');
  card.setPosition(100, 200);
  card.width = 70;
  card.height = 100;
  assert(card.containsPoint(110, 210) === true, 'point inside card');
  assert(card.containsPoint(50, 50) === false, 'point outside card');
  assert(card.containsPoint(100, 200) === true, 'top-left corner');
  assert(card.containsPoint(170, 300) === true, 'bottom-right corner');
  assert(card.containsPoint(171, 200) === false, 'just outside right');
});

// --- Deck Tests ---
console.log('\n[Deck]');

test('createDeck generates 52 cards', () => {
  const deck = createDeck();
  assert(deck.length === 52, `deck length should be 52, got ${deck.length}`);
});

test('createDeck has all suits and ranks', () => {
  const deck = createDeck();
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const found = deck.find(c => c.suit === suit && c.rank === rank);
      assert(found !== undefined, `should have ${rank} of ${suit}`);
    }
  }
});

test('shuffle changes order', () => {
  const deck1 = createDeck();
  const deck2 = createDeck();
  shuffle(deck2);
  // Very unlikely to be same order after shuffle
  let same = 0;
  for (let i = 0; i < 52; i++) {
    if (deck1[i].suit === deck2[i].suit && deck1[i].rank === deck2[i].rank) same++;
  }
  assert(same < 52, 'shuffle should change card order');
});

test('seeded deck is deterministic', () => {
  const deck1 = createSeededDeck(12345);
  const deck2 = createSeededDeck(12345);
  let allSame = true;
  for (let i = 0; i < 52; i++) {
    if (deck1[i].suit !== deck2[i].suit || deck1[i].rank !== deck2[i].rank) {
      allSame = false;
      break;
    }
  }
  assert(allSame, 'same seed should produce same deck');
});

test('different seeds produce different decks', () => {
  const deck1 = createSeededDeck(12345);
  const deck2 = createSeededDeck(54321);
  let same = 0;
  for (let i = 0; i < 52; i++) {
    if (deck1[i].suit === deck2[i].suit && deck1[i].rank === deck2[i].rank) same++;
  }
  assert(same < 52, 'different seeds should produce different decks');
});

// --- Tableau Tests ---
console.log('\n[Tableau]');

test('deal creates correct column sizes', () => {
  const deck = createDeck();
  shuffle(deck);
  const tableau = new Tableau();
  tableau.deal(deck);
  for (let i = 0; i < 7; i++) {
    assert(tableau.columns[i].length === i + 1,
      `column ${i} should have ${i + 1} cards, got ${tableau.columns[i].length}`);
  }
  // Remaining cards
  assert(deck.length === 24, `remaining deck should have 24 cards, got ${deck.length}`);
});

test('deal reveals top card of each column', () => {
  const deck = createDeck();
  shuffle(deck);
  const tableau = new Tableau();
  tableau.deal(deck);
  for (let i = 0; i < 7; i++) {
    const col = tableau.columns[i];
    assert(col[col.length - 1].faceUp === true, `top card of column ${i} should be face up`);
    for (let j = 0; j < col.length - 1; j++) {
      assert(col[j].faceUp === false, `non-top card in column ${i} should be face down`);
    }
  }
});

test('canPlace - alternating colors descending', () => {
  const tableau = new Tableau();
  // Put a red 8 on column 0
  const red8 = new Card('hearts', '8');
  red8.faceUp = true;
  tableau.columns[0] = [red8];

  // Black 7 should be valid
  const black7 = new Card('spades', '7');
  assert(tableau.canPlace(black7, 0) === true, 'black 7 on red 8 should be valid');

  // Red 7 should be invalid (same color)
  const red7 = new Card('hearts', '7');
  assert(tableau.canPlace(red7, 0) === false, 'red 7 on red 8 should be invalid');

  // Black 6 should be invalid (wrong rank)
  const black6 = new Card('spades', '6');
  assert(tableau.canPlace(black6, 0) === false, 'black 6 on red 8 should be invalid');
});

test('canPlace - only Kings on empty columns', () => {
  const tableau = new Tableau();
  tableau.columns[0] = [];

  const king = new Card('spades', 'K');
  assert(tableau.canPlace(king, 0) === true, 'King on empty should be valid');

  const queen = new Card('hearts', 'Q');
  assert(tableau.canPlace(queen, 0) === false, 'Queen on empty should be invalid');

  const ace = new Card('diamonds', 'A');
  assert(tableau.canPlace(ace, 0) === false, 'Ace on empty should be invalid');
});

test('canPickSequence validates correctly', () => {
  const tableau = new Tableau();
  const redQ = new Card('hearts', 'Q'); redQ.faceUp = true;
  const blackJ = new Card('spades', 'J'); blackJ.faceUp = true;
  const red10 = new Card('diamonds', '10'); red10.faceUp = true;
  tableau.columns[0] = [redQ, blackJ, red10];

  assert(tableau.canPickSequence(0, 0) === true, 'can pick full valid sequence');
  assert(tableau.canPickSequence(0, 1) === true, 'can pick partial valid sequence');
  assert(tableau.canPickSequence(0, 2) === true, 'can pick single card');
});

test('canPickSequence rejects invalid sequences', () => {
  const tableau = new Tableau();
  const redQ = new Card('hearts', 'Q'); redQ.faceUp = true;
  const redJ = new Card('diamonds', 'J'); redJ.faceUp = true; // same color!
  tableau.columns[0] = [redQ, redJ];

  assert(tableau.canPickSequence(0, 0) === false, 'should reject same-color sequence');
});

test('canPickSequence rejects face-down cards', () => {
  const tableau = new Tableau();
  const hidden = new Card('spades', 'K'); hidden.faceUp = false;
  const visible = new Card('hearts', 'Q'); visible.faceUp = true;
  tableau.columns[0] = [hidden, visible];

  assert(tableau.canPickSequence(0, 0) === false, 'should reject sequence starting face-down');
  assert(tableau.canPickSequence(0, 1) === true, 'can pick face-up card');
});

test('removeSequence reveals card underneath', () => {
  const tableau = new Tableau();
  const hidden = new Card('spades', 'K'); hidden.faceUp = false;
  const visible = new Card('hearts', 'Q'); visible.faceUp = true;
  tableau.columns[0] = [hidden, visible];

  tableau.removeSequence(0, 1);
  assert(tableau.columns[0].length === 1, 'one card remaining');
  assert(tableau.columns[0][0].faceUp === true, 'remaining card should be revealed');
});

// --- Foundation Tests ---
console.log('\n[Foundation]');

test('canPlace - only Ace on empty', () => {
  const foundation = new Foundation();
  const ace = new Card('spades', 'A');
  assert(foundation.canPlace(ace, 0) === true, 'Ace on empty should be valid');

  const two = new Card('spades', '2');
  assert(foundation.canPlace(two, 0) === false, '2 on empty should be invalid');
});

test('canPlace - same suit ascending', () => {
  const foundation = new Foundation();
  const ace = new Card('spades', 'A'); ace.faceUp = true;
  foundation.placeCard(0, ace);

  const two = new Card('spades', '2');
  assert(foundation.canPlace(two, 0) === true, '2 of spades on A of spades should be valid');

  const three = new Card('spades', '3');
  assert(foundation.canPlace(three, 0) === false, '3 of spades on A should be invalid');

  const twoH = new Card('hearts', '2');
  assert(foundation.canPlace(twoH, 0) === false, '2 of hearts on A of spades should be invalid');
});

test('isComplete detects win', () => {
  const foundation = new Foundation();
  assert(foundation.isComplete() === false, 'empty foundation is not complete');

  // Fill all 4 piles with 13 cards each
  for (let p = 0; p < 4; p++) {
    for (const rank of RANKS) {
      foundation.piles[p].push(new Card(SUITS[p], rank));
    }
  }
  assert(foundation.isComplete() === true, 'full foundation should be complete');
});

test('findValidPile finds correct pile', () => {
  const foundation = new Foundation();
  const aceS = new Card('spades', 'A');
  foundation.placeCard(0, aceS);

  const twoS = new Card('spades', '2');
  assert(foundation.findValidPile(twoS) === 0, 'should find pile 0 for 2 of spades');

  const aceH = new Card('hearts', 'A');
  const validPile = foundation.findValidPile(aceH);
  assert(validPile >= 1 && validPile <= 3, 'should find empty pile for ace of hearts');
});

// --- Stock Tests ---
console.log('\n[Stock]');

test('draw-1 mode', () => {
  const stock = new Stock();
  const cards = [new Card('spades', 'A'), new Card('hearts', '2'), new Card('diamonds', '3')];
  stock.init(cards, 1);

  assert(stock.stock.length === 3, 'stock should have 3 cards');
  assert(stock.waste.length === 0, 'waste should be empty');

  stock.draw();
  assert(stock.stock.length === 2, 'stock should have 2 cards after draw');
  assert(stock.waste.length === 1, 'waste should have 1 card after draw');
  assert(stock.waste[0].faceUp === true, 'waste card should be face up');
});

test('draw-3 mode', () => {
  const stock = new Stock();
  const cards = [];
  for (let i = 0; i < 6; i++) {
    cards.push(new Card('spades', RANKS[i]));
  }
  stock.init(cards, 3);

  stock.draw();
  assert(stock.stock.length === 3, 'stock should have 3 cards after draw-3');
  assert(stock.waste.length === 3, 'waste should have 3 cards after draw-3');
});

test('recycle waste to stock', () => {
  const stock = new Stock();
  const cards = [new Card('spades', 'A'), new Card('hearts', '2')];
  stock.init(cards, 1);

  stock.draw();
  stock.draw();
  assert(stock.isEmpty(), 'stock should be empty');
  assert(stock.waste.length === 2, 'waste should have 2 cards');

  stock.recycle();
  assert(stock.stock.length === 2, 'stock should have 2 cards after recycle');
  assert(stock.waste.length === 0, 'waste should be empty after recycle');
  assert(stock.stock[0].faceUp === false, 'recycled cards should be face down');
});

test('draw from empty stock does nothing', () => {
  const stock = new Stock();
  stock.init([], 1);
  const drawn = stock.draw();
  assert(drawn.length === 0, 'drawing from empty stock returns empty');
});

// --- Game Tests ---
console.log('\n[Game]');

test('game deal initializes correctly', () => {
  const game = new Game({ drawCount: 1 });
  game.deal();

  let totalCards = 0;
  for (const col of game.tableau.columns) totalCards += col.length;
  totalCards += game.stock.stock.length + game.stock.waste.length;
  for (const pile of game.foundation.piles) totalCards += pile.length;

  assert(totalCards === 52, `total cards should be 52, got ${totalCards}`);
  assert(game.state === GAME_STATES.PLAYING, 'state should be PLAYING');
  assert(game.score === 0, 'score should be 0');
  assert(game.moves === 0, 'moves should be 0');
});

test('game move validation', () => {
  const game = new Game({ drawCount: 1, seed: 42 });
  game.deal();

  // The game should be in playing state
  assert(game.state === GAME_STATES.PLAYING, 'should be playing');

  // Try invalid moves
  const result = game.moveTableauToTableau(0, 0, 1);
  // This may or may not be valid depending on seed, just verify it doesn't crash
  assert(typeof result === 'boolean', 'moveTableauToTableau returns boolean');
});

test('game undo works', () => {
  const game = new Game({ drawCount: 1, seed: 100 });
  game.deal();

  const initialScore = game.score;
  game.drawFromStock();
  assert(game.moves === 1, 'moves should be 1 after draw');

  game.undo();
  assert(game.score === initialScore, 'score should be restored after undo');
  assert(game.moves === 0, 'moves should be restored after undo');
});

test('game state machine', () => {
  const game = new Game();
  game.deal();
  assert(game.state === GAME_STATES.PLAYING, 'initial state is PLAYING');

  // Simulate win
  for (let p = 0; p < 4; p++) {
    for (const rank of RANKS) {
      game.foundation.piles[p].push(new Card(SUITS[p], rank));
    }
  }
  game._checkWin();
  assert(game.state === GAME_STATES.WON, 'state should be WON after all foundations filled');
});

test('game hard mode timer', () => {
  const game = new Game({ hardMode: true, hardModeTime: 10 });
  game.deal();

  game.update(5);
  assert(game.state === GAME_STATES.PLAYING, 'still playing at 5s');

  game.update(6);
  assert(game.state === GAME_STATES.LOST, 'lost after time expired');
});

// --- Math Tests ---
console.log('\n[Math]');

test('lerp', () => {
  assert(lerp(0, 10, 0) === 0, 'lerp(0,10,0) = 0');
  assert(lerp(0, 10, 1) === 10, 'lerp(0,10,1) = 10');
  assert(lerp(0, 10, 0.5) === 5, 'lerp(0,10,0.5) = 5');
});

test('clamp', () => {
  assert(clamp(5, 0, 10) === 5, 'clamp(5,0,10) = 5');
  assert(clamp(-5, 0, 10) === 0, 'clamp(-5,0,10) = 0');
  assert(clamp(15, 0, 10) === 10, 'clamp(15,0,10) = 10');
});

test('easeOutQuad', () => {
  assert(easeOutQuad(0) === 0, 'easeOutQuad(0) = 0');
  assert(easeOutQuad(1) === 1, 'easeOutQuad(1) = 1');
  assert(easeOutQuad(0.5) > 0.5, 'easeOutQuad(0.5) > 0.5 (ease out is fast start)');
});

test('createRng is deterministic', () => {
  const rng1 = createRng(42);
  const rng2 = createRng(42);
  const v1 = [rng1(), rng1(), rng1()];
  const v2 = [rng2(), rng2(), rng2()];
  assert(v1[0] === v2[0] && v1[1] === v2[1] && v1[2] === v2[2],
    'same seed produces same sequence');
});

test('createRng produces values in [0,1)', () => {
  const rng = createRng(99);
  let allValid = true;
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    if (v < 0 || v >= 1) { allValid = false; break; }
  }
  assert(allValid, 'all values in [0,1)');
});

// --- Progression Math Tests ---
console.log('\n[Progression]');

test('xpForLevel calculates correctly', () => {
  assert(xpForLevel(1) === 0, 'level 1 requires 0 xp');
  assert(xpForLevel(2) === Math.floor(100 * Math.pow(2, 1.5)), 'level 2 xp formula');
  assert(xpForLevel(3) > xpForLevel(2), 'xp increases with level');
  assert(xpForLevel(5) > xpForLevel(4), 'level 5 > level 4');
});

test('totalXpForLevel is cumulative', () => {
  const total3 = totalXpForLevel(3);
  assert(total3 === xpForLevel(2) + xpForLevel(3), 'total for level 3 is sum of 2+3');
  assert(totalXpForLevel(1) === 0, 'total for level 1 is 0');
});

test('levelFromXp is inverse of totalXpForLevel', () => {
  assert(levelFromXp(0) === 1, '0 xp is level 1');
  const xpForLvl2 = totalXpForLevel(2);
  assert(levelFromXp(xpForLvl2) === 2, 'exact xp gives level 2');
  assert(levelFromXp(xpForLvl2 - 1) === 1, 'just under level 2 xp is level 1');
  const xpForLvl5 = totalXpForLevel(5);
  assert(levelFromXp(xpForLvl5) === 5, 'exact xp gives level 5');
});

test('calculateGameXp base values', () => {
  const lossXp = calculateGameXp({ won: false, time: 300, usedUndo: false, streak: 0 });
  assert(lossXp === 10, 'loss gives base 10 xp');

  const winXp = calculateGameXp({ won: true, time: 300, usedUndo: true, streak: 0 });
  assert(winXp === 60, 'win without speed/noundo gives 60 xp (10+50)');

  const fastWinXp = calculateGameXp({ won: true, time: 120, usedUndo: false, streak: 0 });
  assert(fastWinXp === 110, 'fast win no undo gives 110 xp (10+50+30+20)');
});

test('calculateGameXp streak bonus', () => {
  const withStreak = calculateGameXp({ won: true, time: 300, usedUndo: true, streak: 5 });
  // 10 + 50 + 5*10 = 110
  assert(withStreak === 110, 'streak adds bonus xp');
});

// --- Daily Seed Tests ---
console.log('\n[Daily Seeds]');

test('getDailySeed is deterministic for same date', () => {
  const date = new Date(2024, 6, 1);
  const s1 = getDailySeed(date);
  const s2 = getDailySeed(date);
  assert(s1 === s2, 'same date gives same seed');
});

test('getDailySeed differs for different dates', () => {
  const date1 = new Date(2024, 6, 1);
  const date2 = new Date(2024, 6, 2);
  const s1 = getDailySeed(date1);
  const s2 = getDailySeed(date2);
  assert(s1 !== s2, 'different dates give different seeds');
});

test('getDailySeed produces same shuffle for same date', () => {
  const date = new Date(2024, 3, 15);
  const seed = getDailySeed(date);
  const deck1 = createSeededDeck(seed);
  const deck2 = createSeededDeck(seed);
  let allSame = true;
  for (let i = 0; i < 52; i++) {
    if (deck1[i].suit !== deck2[i].suit || deck1[i].rank !== deck2[i].rank) {
      allSame = false;
      break;
    }
  }
  assert(allSame, 'same daily seed produces same deck');
});

test('getDailySeed produces different shuffle for different date', () => {
  const seed1 = getDailySeed(new Date(2024, 0, 1));
  const seed2 = getDailySeed(new Date(2024, 0, 2));
  const deck1 = createSeededDeck(seed1);
  const deck2 = createSeededDeck(seed2);
  let same = 0;
  for (let i = 0; i < 52; i++) {
    if (deck1[i].suit === deck2[i].suit && deck1[i].rank === deck2[i].rank) same++;
  }
  assert(same < 52, 'different daily seeds produce different decks');
});

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
