// Black Nyack engine tests: deck/deal, values, betting, turns, dealer,
// filtered views, leave/rebuy, bots + a 500-round bot soak.
// Run: node test/engine.test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const engineSrc = blocks.find(s => s.includes('module.exports'));
if (!engineSrc) { console.error('FAIL: engine script block not found'); process.exit(1); }

const sandbox = { module: { exports: {} }, console };
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);
const E = sandbox.module.exports;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}
const C = (rank, suit) => ({ id: rank + suit, rank, suit });
const SP = (i) => ({ id: 'SP' + i, rank: 'SP', suit: 'special', special: true });
/* Rig a hand: card[0] face-up, card[1] face-down unless it is special.
   Later cards are set face-up for convenience — a REAL hit/double-down card
   comes folded (face-down until the dealer plays); tests that need a real
   folded card deal one for real instead of rigging it here. */
function setHand(st, pid, cards) {
  E.playerById(st, pid).hand = cards.map((c, i) => ({
    ...c, faceUp: c.special ? true : (i === 0 ? true : i >= 2)
  }));
}
function setDealerHand(st, cards) {
  st.dealer.hand = cards.map((c, i) => ({
    ...c, faceUp: c.special ? true : (i === 0 ? true : i >= 2)
  }));
}
function mkGame(n, seed, opts) {
  const names = [];
  for (let i = 0; i < n; i++) names.push('P' + i);
  return E.newGame(names, seed === undefined ? 42 : seed, opts);
}
/* Bet for every seated player (amount or 'spectate'); drives the deal. */
function betAll(st, amounts) {
  for (const p of st.players.slice()) {
    if (p.left) continue;
    const a = amounts ? amounts[p.id] : 10;
    const r = a === 'spectate'
      ? E.applyAction(st, p.id, { type: 'spectate' })
      : E.applyAction(st, p.id, { type: 'placeBet', amount: a });
    if (!r.ok) throw new Error('bet failed for ' + p.id + ': ' + r.error);
  }
  if (st.phase !== 'playerTurns') throw new Error('expected playerTurns, got ' + st.phase);
  return st;
}
/* Play out every player turn with the bot (seeded rnd per round). */
function playTurns(st, rnd) {
  let guard = 0;
  while (st.phase === 'playerTurns' && guard++ < 50) {
    const pid = st.turnPlayerId;
    const a = E.botChooseAction(st, pid, rnd);
    if (!a) throw new Error('bot returned no action for ' + pid + ' in ' + st.phase);
    const r = E.applyAction(st, pid, a);
    if (!r.ok) throw new Error('bot action failed for ' + pid + ' ' + JSON.stringify(a) + ': ' + r.error);
  }
  // Nyau draws one card at a time — finish his turn, then the round settles.
  if (st.phase === 'dealerTurn') E.dealerPlay(st);
  if (st.phase !== 'settled') throw new Error('expected settled, got ' + st.phase);
  return st;
}

console.log('Constants:');
{
  check('BETS are 5/10/20/40/50', JSON.stringify(E.BETS) === '[5,10,20,40,50]');
  check('START_STACK is 1000', E.START_STACK === 1000);
  check('MAX_PLAYERS is 5', E.MAX_PLAYERS === 5);
  check('MAX_PAYOUT is 1200', E.MAX_PAYOUT === 1200);
  check('BATTLE_ODDS is 0.08', E.BATTLE_ODDS === 0.08);
  check('DEALER_STAND is 17', E.DEALER_STAND === 17);
  check('special die faces are 0,0,1,1,2,2', JSON.stringify(E.SPECIAL_DIE_FACES) === '[0,0,1,1,2,2]');
  check('die has 6 faces', E.SPECIAL_DIE_FACES.length === 6);
  check('die has exactly two blank sides worth 0', E.SPECIAL_DIE_FACES.filter(f => f === 0).length === 2);
  check('die has exactly two 1s and two 2s', E.SPECIAL_DIE_FACES.filter(f => f === 1).length === 2 && E.SPECIAL_DIE_FACES.filter(f => f === 2).length === 2);
  // every roll is recorded in the round's roll list, in order — the die
  // watches this list, never the game log (a 0-roll is still a roll)
  check('rollSpecialDie records the face in round.rolls', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    const r1 = E.rollSpecialDie(st, 'A');
    const r2 = E.rollSpecialDie(st, 'B');
    return JSON.stringify(st.round.rolls) === JSON.stringify([r1, r2]) && st.round.specialTotal === r1 + r2;
  })());
  check('a 0-roll is recorded (total stays 0, roll list still grows)', (() => {
    // find a seed whose first roll is a blank side
    for (let s = 1; s < 200; s++) {
      const st = mkGame(2, s, { forceBattle: false });
      const r = E.rollSpecialDie(st, 'A');
      if (r === 0) return st.round.rolls.length === 1 && st.round.rolls[0] === 0 && st.round.specialTotal === 0;
    }
    return false;
  })());
  check('rolls reset on the next round', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    E.rollSpecialDie(st, 'A');
    betAll(st, { p0: 10, p1: 10 });
    E.nextRound(st);
    return st.round.rolls.length === 0 && st.round.specialTotal === 0;
  })());
  check('viewFor carries the roll list', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    E.rollSpecialDie(st, 'A');
    return JSON.stringify(E.viewFor(st, 'p0').round.rolls) === JSON.stringify(st.round.rolls);
  })());
}

console.log('Folded hit / double-down cards:');
{
  // Rig the deck top so the next card dealt is a known non-special card.
  function rigTop(st, rank, suit) { st.deck.push({ id: rank + suit + '-rig', rank, suit }); }
  check('hit cards come folded (face-down for everyone else)', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('5', '♠'), C('6', '♥')]); // 11 — a hit is legal
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    rigTop(st, '2', '♣');
    const r = E.applyAction(st, 'p0', { type: 'hit' });
    const c = E.playerById(st, 'p0').hand[2];
    return r.ok && c && c.rank === '2' && c.faceUp === false;
  })());
  check('double-down cards come folded too', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('5', '♠'), C('6', '♥')]); // 11 — doubling is legal
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    rigTop(st, '3', '♦');
    const r = E.applyAction(st, 'p0', { type: 'double' });
    const c = E.playerById(st, 'p0').hand[2];
    return r.ok && c && c.rank === '3' && c.faceUp === false;
  })());
  check('a folded special is still face-up (specials are always face-up)', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('5', '♠'), C('6', '♥')]);
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    st.deck.push({ id: 'SP-rig', rank: 'SP', suit: 'special', special: true });
    const r = E.applyAction(st, 'p0', { type: 'hit' });
    const c = E.playerById(st, 'p0').hand[2];
    return r.ok && c && c.special === true && c.faceUp === true;
  })());
  check('another player cannot see my folded hit card, but I can', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('5', '♠'), C('6', '♥')]);
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    rigTop(st, '2', '♣');
    E.applyAction(st, 'p0', { type: 'hit' });
    const mine = E.viewFor(st, 'p0').players.find(p => p.id === 'p0').cards[2];
    const theirs = E.viewFor(st, 'p1').players.find(p => p.id === 'p0').cards[2];
    return mine && mine.rank === '2' && theirs && theirs.hidden === true;
  })());
  check('dealer play opens every folded card automatically', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('5', '♠'), C('6', '♥')]); // p0 hits (folded card), then stays
    setHand(st, 'p1', [C('9', '♣'), C('8', '♦')]); // p1 stays on 17
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    rigTop(st, '2', '♣');
    E.applyAction(st, 'p0', { type: 'hit' });
    const foldedBefore = E.playerById(st, 'p0').hand[2].faceUp === false;
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' }); // dealer plays, then settles
    E.dealerPlay(st); // finish Nyau's turn (he draws one card at a time)
    return foldedBefore && st.phase === 'settled' &&
      st.players.every(p => p.hand.every(c => c.faceUp === true));
  })());
  check('hole cards open at dealer play too', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    const holeBefore = st.players.every(p => p.hand[1].faceUp === false || p.hand[1].special);
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    E.dealerPlay(st); // finish Nyau's turn (he draws one card at a time)
    return holeBefore && st.phase === 'settled' &&
      st.players.every(p => p.hand.every(c => c.faceUp === true));
  })());
}

console.log('Ace hands show both totals ("4 or 14"):');
{
  const bv = (cards) => E.bestValue(cards.map(c => C(c[0], c[1])), 0);
  check('A+3 is 14 with low 4 (soft)', (() => { const v = bv([['A', '♠'], ['3', '♥']]); return v.total === 14 && v.low === 4 && v.soft === true; })());
  check('A+K is 21 with low 11 (soft)', (() => { const v = bv([['A', '♠'], ['K', '♥']]); return v.total === 21 && v.low === 11 && v.soft === true; })());
  check('A+K+9 is 20 with low 20 (no soft total)', (() => { const v = bv([['A', '♠'], ['K', '♥'], ['9', '♦']]); return v.total === 20 && v.low === 20 && v.soft === false; })());
  check('A+A+9 is 21 with low 11 (one Ace as 11)', (() => { const v = bv([['A', '♠'], ['A', '♥'], ['9', '♦']]); return v.total === 21 && v.low === 11 && v.soft === true; })());
  check('9+7 is 16 with low 16 (no Ace, single total)', (() => { const v = bv([['9', '♠'], ['7', '♥']]); return v.total === 16 && v.low === 16 && v.soft === false; })());
  check('the view carries the low total for my hand', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('A', '♠'), C('3', '♥')]);
    const me = E.viewFor(st, 'p0').players.find(p => p.id === 'p0');
    return me.total === 14 && me.low === 4;
  })());
}

console.log('Stepwise dealer turn:');
{
  check('dealerStart flips the hole card and opens the players, but draws nothing yet', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    return st.phase === 'dealerTurn' && st.dealer.hand.length === 2 &&
      st.dealer.hand.every(c => c.faceUp === true) &&
      st.players.every(p => p.hand.every(c => c.faceUp === true));
  })());
  check('dealerDrawOne draws exactly one card per call', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    // rig the dealer's hand low so he must draw, and the deck top so the draw is known
    st.dealer.hand = [C('2', '♠'), C('3', '♥')].map((c, i) => ({ ...c, faceUp: true }));
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    const before = st.dealer.hand.length;
    st.deck.push({ id: '4♣-rig', rank: '4', suit: '♣' });
    const r = E.dealerDrawOne(st);
    return st.phase === 'dealerTurn' && r.drew === true && r.total === 9 &&
      st.dealer.hand.length === before + 1 && st.dealer.hand[2].rank === '4';
  })());
  check('dealerDrawOne stops at 17 and stands (no second draw, one stand line)', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    st.dealer.hand = [C('9', '♠'), C('8', '♥')].map((c, i) => ({ ...c, faceUp: true }));
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    const r1 = E.dealerDrawOne(st);
    const r2 = E.dealerDrawOne(st);
    const stands = st.round.log.filter(l => l.includes('Dealer stands on 17')).length;
    return r1.drew === false && r1.stood === true && r1.total === 17 &&
      r2.drew === false && r2.stood === true && stands === 1;
  })());
  check('the dealer total is visible in the view during his turn', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    st.dealer.hand = [C('9', '♠'), C('8', '♥')].map((c, i) => ({ ...c, faceUp: true }));
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    const dv = E.viewFor(st, 'p0').dealer;
    return st.phase === 'dealerTurn' && dv.total === 17 && dv.low === 17;
  })());
  check('the dealer never draws a 6th card — he stands at 5 even under 17', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    // the dealer holds 5 cards totalling 16 — under 17, but already at the cap
    st.dealer.hand = [C('2', '♠'), C('3', '♥'), C('4', '♦'), C('5', '♣'), C('2', '♦')].map((c, i) => ({ ...c, faceUp: true }));
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    const r = E.dealerDrawOne(st);
    const stands = st.round.log.join(' ').includes('Dealer stands on 16 with 5 cards');
    E.dealerPlay(st);
    return r.drew === false && r.stood === true && r.total === 16 &&
      st.dealer.hand.length === 5 && stands && st.phase === 'settled';
  })());
  check('dealerPlay (the whole turn at once) still settles a full round', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('9', '♣'), C('8', '♦')]);
    setHand(st, 'p1', [C('9', '♠'), C('8', '♥')]);
    E.applyAction(st, 'p0', { type: 'stay' });
    E.applyAction(st, 'p1', { type: 'stay' });
    E.dealerPlay(st);
    return st.phase === 'settled' && !!st.results;
  })());
  check('everyone busted: the dealer does not draw, the round settles at once', (() => {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('K', '♠'), C('Q', '♥'), C('5', '♦')]); // 25 — busts on the hit
    setHand(st, 'p1', [C('K', '♣'), C('Q', '♦'), C('5', '♠')]);
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    st.deck.push({ id: '5♣-rig', rank: '5', suit: '♣' });
    E.applyAction(st, 'p0', { type: 'hit' });
    E.applyAction(st, 'p1', { type: 'hit' });
    return st.phase === 'settled' && st.dealer.hand.length === 2 &&
      st.round.log.join(' ').includes('does not draw');
  })());
}

console.log('No Hit / Double Down at 21:');
{
  function at21Game() {
    const st = mkGame(2, 42, { forceBattle: false });
    betAll(st, { p0: 10, p1: 10 });
    setHand(st, 'p0', [C('A', '♠'), C('K', '♥')]); // 21
    st.phase = 'playerTurns'; st.turnPlayerId = 'p0';
    return st;
  }
  const st = at21Game();
  const acts = E.legalActions(st, 'p0').map(a => a.type);
  check('at 21, legal actions are only stay (+leave)', JSON.stringify(acts) === '["leave","stay"]', acts.join(','));
  check('at 21, Hit is refused', E.applyAction(at21Game(), 'p0', { type: 'hit' }).ok === false);
  check('at 21, Double Down is refused', E.applyAction(at21Game(), 'p0', { type: 'double' }).ok === false);
  check('at 21, Stay still works', E.applyAction(at21Game(), 'p0', { type: 'stay' }).ok === true);
  const st20 = mkGame(2, 42, { forceBattle: false });
  betAll(st20, { p0: 10, p1: 10 });
  setHand(st20, 'p0', [C('K', '♠'), C('Q', '♥')]); // 20
  st20.phase = 'playerTurns'; st20.turnPlayerId = 'p0';
  const acts20 = E.legalActions(st20, 'p0').map(a => a.type);
  check('at 20, Hit and Double Down are still legal', acts20.includes('hit') && acts20.includes('double'), acts20.join(','));
  check('at 20, Hit is accepted', E.applyAction(st20, 'p0', { type: 'hit' }).ok === true);
}

console.log('Deck:');
{
  const deck = E.buildDeck();
  check('deck has 58 cards (52 + 6 special)', deck.length === 58);
  check('deck has exactly 6 special cards', deck.filter(c => c.special).length === 6);
  check('special ids are SP1..SP6', deck.filter(c => c.special).map(c => c.id).join(',') === 'SP1,SP2,SP3,SP4,SP5,SP6');
  check('52 standard cards are unique', new Set(deck.filter(c => !c.special).map(c => c.id)).size === 52);
  check('newGame rejects 0 players', (() => { try { E.newGame([], 1); return false; } catch (e) { return true; } })());
  check('newGame rejects 6 players', (() => { try { E.newGame(['a','b','c','d','e','f'], 1); return false; } catch (e) { return true; } })());
  check('newGame allows 1 player (solo vs dealer)', E.newGame(['Solo'], 1).players.length === 1);
  check('newGame allows 5 players', E.newGame(['a','b','c','d','e'], 1).players.length === 5);
  check('new game starts in betting with 1000 each', (() => { const s = mkGame(3, 5); return s.phase === 'betting' && s.players.every(p => p.stack === 1000); })());
}

console.log('Deal:');
{
  const st = mkGame(3, 7, { forceBattle: false });
  betAll(st, { p0: 10, p1: 20, p2: 50 });
  check('each entrant gets 2 cards, dealer gets 2', st.players.every(p => p.hand.length === 2) && st.dealer.hand.length === 2);
  check('deck shrinks by the cards dealt (58 - 8)', st.deck.length === 50);
  check('all dealt cards are unique', (() => {
    const all = st.players.flatMap(p => p.hand).concat(st.dealer.hand, st.deck);
    return new Set(all.map(c => c.id)).size === 58;
  })());
  check('first card is face-up, second is the hole card', st.players.every(p => p.hand[0].faceUp === true && (p.hand[1].faceUp === false || p.hand[1].special)));
  check('dealer first card up, second down (unless special)', st.dealer.hand[0].faceUp === true && (st.dealer.hand[1].faceUp === false || st.dealer.hand[1].special));
  check('special cards are always face-up', st.players.concat([{ hand: st.dealer.hand }]).flatMap(p => p.hand).filter(c => c.special).every(c => c.faceUp === true));
  check('phase is playerTurns, first seat to act', st.phase === 'playerTurns' && st.turnPlayerId === 'p0');
  check('bets are deducted immediately', st.players[0].stack === 990 && st.players[1].stack === 980 && st.players[2].stack === 950);
  check('specialTotal is 0 before the deal', (() => { const s = mkGame(3, 7, { forceBattle: false }); return s.round.specialTotal === 0; })());
  // Determinism: same seed -> same deal.
  const a = mkGame(3, 99, { forceBattle: false }); betAll(a);
  const b = mkGame(3, 99, { forceBattle: false }); betAll(b);
  check('same seed deals the same cards', JSON.stringify(a.players.map(p => p.hand)) === JSON.stringify(b.players.map(p => p.hand)) &&
    JSON.stringify(a.dealer.hand) === JSON.stringify(b.dealer.hand));
  check('different seed deals different cards', (() => {
    const c = mkGame(3, 100, { forceBattle: false }); betAll(c);
    return JSON.stringify(c.players.map(p => p.hand)) !== JSON.stringify(a.players.map(p => p.hand));
  })());
}

console.log('Hand values:');
{
  const v = (cards, sp) => E.bestValue(cards, sp || 0);
  check('numbered cards are face value', v([C('7', '♠'), C('5', '♥')]).total === 12);
  check('J/Q/K are worth 10', v([C('J', '♠'), C('Q', '♥'), C('K', '♦')]).total === 30);
  check('Ace + King is 21 (soft)', v([C('A', '♠'), C('K', '♥')]).total === 21 && v([C('A', '♠'), C('K', '♥')]).soft === true);
  check('Ace counts as 1 when 11 would bust', v([C('A', '♠'), C('9', '♥'), C('5', '♦')]).total === 15);
  check('two Aces + 9 is 21', v([C('A', '♠'), C('A', '♥'), C('9', '♦')]).total === 21);
  check('Ace + 6 is soft 17', v([C('A', '♠'), C('6', '♥')]).total === 17 && v([C('A', '♠'), C('6', '♥')]).soft === true);
  check('K + Q + 2 busts at 22', v([C('K', '♠'), C('Q', '♥'), C('2', '♦')]).bust === true);
  check('special is worth the shared specialTotal', v([SP(1)], 3).total === 3);
  check('special is worth 0 when the total is 0', v([SP(1)], 0).total === 0);
  check('special + Ace: 3 + 11 = 14 soft', v([SP(1), C('A', '♠')], 3).total === 14 && v([SP(1), C('A', '♠')], 3).soft === true);
  check('two specials stack the shared value', v([SP(1), SP(2)], 2).total === 4);
  const hc = (cards, sp) => E.handClass(cards, sp || 0);
  check('class: bust is 0', hc([C('K', '♠'), C('Q', '♥'), C('2', '♦')]).cls === 0);
  check('class: normal is 1', hc([C('9', '♠'), C('8', '♥')]).cls === 1);
  check('class: 21 with <5 cards is 2', hc([C('A', '♠'), C('K', '♥')]).cls === 2);
  check('class: 5 cards under 21 is 3', hc([C('2', '♠'), C('2', '♥'), C('3', '♦'), C('4', '♣'), C('5', '♠')]).cls === 3);
  check('class: 5 cards totalling 21 is 4', hc([C('2', '♠'), C('3', '♥'), C('4', '♦'), C('5', '♣'), C('7', '♠')]).cls === 4);
  check('class: 5-card 21 outranks plain 21', hc([C('2', '♠'), C('3', '♥'), C('4', '♦'), C('5', '♣'), C('7', '♠')]).cls > hc([C('A', '♠'), C('K', '♥')]).cls);
}

console.log('Betting:');
{
  check('invalid bet amount is rejected', (() => { const s = mkGame(2, 11, { forceBattle: false }); return E.applyAction(s, 'p0', { type: 'placeBet', amount: 30 }).ok === false; })());
  check('bet above the stack is rejected', (() => { const s = mkGame(2, 12, { forceBattle: false }); s.players[0].stack = 10; return E.applyAction(s, 'p0', { type: 'placeBet', amount: 50 }).ok === false && s.players[0].stack === 10; })());
  check('cannot decide twice', (() => { const s = mkGame(2, 13, { forceBattle: false }); E.applyAction(s, 'p0', { type: 'placeBet', amount: 10 }); return E.applyAction(s, 'p0', { type: 'placeBet', amount: 10 }).ok === false; })());
  check('unknown player is rejected', (() => { const s = mkGame(2, 14, { forceBattle: false }); return E.applyAction(s, 'px', { type: 'placeBet', amount: 10 }).ok === false; })());
  // Dead round: nobody bets.
  const dead = mkGame(3, 15, { forceBattle: false });
  E.applyAction(dead, 'p0', { type: 'spectate' });
  E.applyAction(dead, 'p1', { type: 'spectate' });
  const dr = E.applyAction(dead, 'p2', { type: 'spectate' });
  check('dead round stays in betting and deals nothing', dead.phase === 'betting' && dead.players.every(p => p.hand.length === 0) && dead.deck.length === 0 && dr.dead === true);
  check('dead round logs the dead round', dead.round.log.join(' ').includes('Dead round'));
  check('dead round resets decisions so players can bet again', dead.players.every(p => p.decided === false && p.spectating === false));
  check('betting works again after a dead round', (() => { betAll(dead); return dead.phase === 'playerTurns'; })());
  // Dead-round retry: a bot that spectates once must not spectate forever.
  // Its default coin-flip is seeded from (seed, round, seat), so without
  // the dead-round counter mixed into the seed it would repeat the same
  // spectate decision after every dead round and a table where everyone
  // spectates could never start.
  {
    let found = null;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const g = E.newGame([{ name: 'H', isBot: false }, { name: 'B', isBot: true }], seed, { forceBattle: false });
      const a = E.botChooseAction(g, 'p1');
      if (a && a.type === 'spectate') found = g;
    }
    check('found a seed where the bot spectates first', !!found);
    if (found) {
      const g = found;
      let tries = 0;
      while (g.phase === 'betting' && tries++ < 20) {
        E.applyAction(g, 'p0', { type: 'spectate' });
        const a = E.botChooseAction(g, 'p1');
        if (a) E.applyAction(g, 'p1', a);
      }
      check('table eventually starts after repeated dead rounds', g.phase === 'playerTurns', 'phase=' + g.phase + ' after ' + tries + ' tries');
      check('dead rounds were counted', (g.round.deadCount || 0) > 0, 'deadCount=' + g.round.deadCount);
    }
  }
  // Spectator sits out, keeps chips, is offered entry next round.
  const spec = mkGame(3, 16, { forceBattle: false });
  betAll(spec, { p0: 10, p1: 10, p2: 'spectate' });
  check('spectator keeps chips and gets no cards', E.playerById(spec, 'p2').stack === 1000 && E.playerById(spec, 'p2').hand.length === 0 && E.playerById(spec, 'p2').spectating === true);
  playTurns(spec, E.mulberry32(1));
  check('round settles with a spectator at the table', spec.phase === 'settled');
  const nx = E.applyAction(spec, 'p0', { type: 'nextRound' });
  check('next round opens betting again', nx.ok === true && spec.phase === 'betting' && spec.roundNumber === 2);
  check('spectator is offered entry at the next round', E.legalActions(spec, 'p2').some(a => a.type === 'placeBet'));
  betAll(spec, { p0: 10, p1: 10, p2: 10 });
  check('spectator can enter the next round', E.playerById(spec, 'p2').hand.length === 2 && E.playerById(spec, 'p2').spectating === false);
  // Rebuy.
  const rb = mkGame(2, 17, { forceBattle: false });
  betAll(rb); playTurns(rb, E.mulberry32(2));
  const loser = rb.players.find(p => p.id !== (rb.results && Object.keys(rb.results).find(id => rb.results[id].outcome === 'win')));
  check('rebuy rejected with chips left', E.applyAction(rb, 'p0', { type: 'rebuy' }).ok === false);
  const broke = rb.players[0]; broke.stack = 0;
  check('broke player rebuys 1000 between rounds', E.applyAction(rb, 'p0', { type: 'rebuy' }).ok === true && broke.stack === 1000);
  check('rebuy rejected mid-round', (() => { const s = mkGame(2, 18, { forceBattle: false }); betAll(s); s.players[0].stack = 0; return E.applyAction(s, 'p0', { type: 'rebuy' }).ok === false; })());
}

console.log('Player turns (hit / stay / double):');
{
  // Hit up to 3 times (5 cards), 4th hit is an error; 5 cards auto-stands.
  const st = mkGame(2, 21, { forceBattle: false });
  betAll(st);
  setHand(st, 'p0', [C('2', '♠'), C('3', '♥')]);
  st.deck = [C('2', '♦'), C('2', '♣'), C('2', '♠'), C('2', '♥')]; // top of deck is the end
  let r = E.applyAction(st, 'p0', { type: 'hit' });
  check('hit 1 works', r.ok === true && E.playerById(st, 'p0').hand.length === 3);
  r = E.applyAction(st, 'p0', { type: 'hit' });
  check('hit 2 works', r.ok === true && E.playerById(st, 'p0').hand.length === 4);
  r = E.applyAction(st, 'p0', { type: 'hit' });
  check('hit 3 reaches 5 cards and auto-stands', r.ok === true && E.playerById(st, 'p0').hand.length === 5 && E.playerById(st, 'p0').stood === true);
  check('turn passes after 5 cards', st.turnPlayerId === 'p1');
  check('4th hit is rejected (already 5 cards)', (() => { const s = mkGame(2, 22, { forceBattle: false }); betAll(s); setHand(s, 'p0', [C('2','♠'), C('3','♥'), C('2','♦'), C('2','♣'), C('2','♠')]); s.players[0].stood = false; return E.applyAction(s, 'p0', { type: 'hit' }).ok === false; })());
  // Hit and bust.
  const st2 = mkGame(2, 23, { forceBattle: false });
  betAll(st2);
  setHand(st2, 'p0', [C('K', '♠'), C('Q', '♥')]);
  st2.deck = [C('5', '♦')];
  r = E.applyAction(st2, 'p0', { type: 'hit' });
  check('hitting into a bust marks the player busted', r.ok === true && E.playerById(st2, 'p0').busted === true);
  check('turn passes after a bust', st2.turnPlayerId === 'p1');
  check('out-of-turn hit is rejected', E.applyAction(st2, 'p0', { type: 'hit' }).ok === false);
  // Stay.
  const st3 = mkGame(2, 24, { forceBattle: false });
  betAll(st3);
  r = E.applyAction(st3, 'p0', { type: 'stay' });
  check('stay works and passes the turn', r.ok === true && E.playerById(st3, 'p0').stood === true && st3.turnPlayerId === 'p1');
  // Double down: only with 2 cards, doubles the bet, exactly one card, forced stand.
  const st4 = mkGame(2, 25, { forceBattle: false });
  betAll(st4, { p0: 50, p1: 10 });
  const before = E.playerById(st4, 'p0').stack; // 950
  st4.deck = [C('5', '♦')];
  r = E.applyAction(st4, 'p0', { type: 'double' });
  check('double down doubles the bet and deducts the extra', r.ok === true && E.playerById(st4, 'p0').bet === 100 && E.playerById(st4, 'p0').stack === before - 50 && E.playerById(st4, 'p0').doubled === true);
  check('double down deals exactly one card and forces a stand', E.playerById(st4, 'p0').hand.length === 3 && E.playerById(st4, 'p0').stood === true && st4.turnPlayerId === 'p1');
  check('double down is rejected with 3+ cards', (() => { const s = mkGame(2, 26, { forceBattle: false }); betAll(s); setHand(s, 'p0', [C('2','♠'), C('3','♥'), C('4','♦')]); return E.applyAction(s, 'p0', { type: 'double' }).ok === false; })());
  check('double down is rejected when the stack cannot cover it', (() => { const s = mkGame(2, 27, { forceBattle: false }); betAll(s, { p0: 50, p1: 10 }); s.players[0].stack = 10; return E.applyAction(s, 'p0', { type: 'double' }).ok === false && s.players[0].bet === 50; })());
  // Special die: a special hit rolls and raises the shared total.
  const st5 = mkGame(2, 28, { forceBattle: false });
  betAll(st5);
  setHand(st5, 'p0', [C('2', '♠'), C('3', '♥')]);
  st5.deck = [SP(1)];
  const totalBefore = st5.round.specialTotal;
  r = E.applyAction(st5, 'p0', { type: 'hit' });
  check('hitting a special card rolls the die', r.ok === true && st5.round.specialTotal >= totalBefore && st5.round.specialTotal <= totalBefore + 2);
  check('special die roll is logged', st5.round.log.join(' ').match(/rolled [012] — special cards now worth \d+/));
  check('the dealt special card is face-up', E.playerById(st5, 'p0').hand[2].faceUp === true);
}

console.log('Dealer:');
{
  // Dealer stands on hard 17.
  const st = mkGame(2, 31, { forceBattle: false });
  betAll(st);
  setHand(st, 'p0', [C('K', '♠'), C('Q', '♥')]); // 20, stays
  setDealerHand(st, [C('K', '♦'), C('7', '♣')]); // 17
  E.applyAction(st, 'p0', { type: 'stay' });
  E.applyAction(st, 'p1', { type: 'stay' });
  E.dealerPlay(st); // Nyau draws one card at a time — finish his turn here
  check('dealer stands on hard 17 without drawing', st.phase === 'settled' && st.dealer.hand.length === 2);
  // Dealer stands on SOFT 17 (Ace + 6).
  const st2 = mkGame(2, 32, { forceBattle: false });
  betAll(st2);
  setHand(st2, 'p0', [C('K', '♠'), C('Q', '♥')]);
  setDealerHand(st2, [C('A', '♦'), C('6', '♣')]); // soft 17
  st2.deck = [C('2', '♦')];
  E.applyAction(st2, 'p0', { type: 'stay' });
  E.applyAction(st2, 'p1', { type: 'stay' });
  E.dealerPlay(st2);
  check('dealer stands on soft 17', st2.phase === 'settled' && st2.dealer.hand.length === 2);
  // Dealer hits on 16 and stops at 17+.
  const st3 = mkGame(2, 33, { forceBattle: false });
  betAll(st3);
  setHand(st3, 'p0', [C('K', '♠'), C('Q', '♥')]);
  setDealerHand(st3, [C('K', '♦'), C('6', '♣')]); // 16
  st3.deck = [C('5', '♦'), C('2', '♠')]; // draws 2 (18), stops
  E.applyAction(st3, 'p0', { type: 'stay' });
  E.applyAction(st3, 'p1', { type: 'stay' });
  E.dealerPlay(st3);
  check('dealer hits on 16 and stands on 18', st3.phase === 'settled' && st3.dealer.hand.length === 3 && E.bestValue(st3.dealer.hand, 0).total === 18);
  // Dealer busts.
  const st4 = mkGame(2, 34, { forceBattle: false });
  betAll(st4);
  setHand(st4, 'p0', [C('K', '♠'), C('8', '♥')]); // 18
  setDealerHand(st4, [C('K', '♦'), C('6', '♣')]); // 16
  st4.deck = [C('9', '♦')]; // draws 9 -> 25 bust
  E.applyAction(st4, 'p0', { type: 'stay' });
  E.applyAction(st4, 'p1', { type: 'stay' });
  E.dealerPlay(st4);
  check('dealer busts when drawing over 21', st4.phase === 'settled' && E.bestValue(st4.dealer.hand, 0).bust === true && st4.results['p0'].outcome === 'win');
  // Dealer does not draw when every entrant busted.
  const st5 = mkGame(2, 35, { forceBattle: false });
  betAll(st5);
  setHand(st5, 'p0', [C('K', '♠'), C('Q', '♥')]);
  setDealerHand(st5, [C('K', '♦'), C('6', '♣')]); // 16 — would draw if anyone were alive
  st5.deck = [C('2', '♦'), C('3', '♠'), C('4', '♥')];
  const deckBefore = st5.deck.length;
  st5.deck = [C('5', '♦')].concat(st5.deck); // top card is a 5: p0 busts on it
  E.applyAction(st5, 'p0', { type: 'hit' }); // 20 + 5 = bust
  setHand(st5, 'p1', [C('K', '♣'), C('Q', '♦')]);
  st5.deck = [C('5', '♣')];
  E.applyAction(st5, 'p1', { type: 'hit' }); // busts too
  check('dealer does not draw when all entrants busted', st5.phase === 'settled' && st5.dealer.hand.length === 2 && st5.deck.length === 0);
  check('both busted players lose', st5.results['p0'].outcome === 'lose' && st5.results['p1'].outcome === 'lose');
  // Dealer hole card is revealed at the dealer turn.
  const st6 = mkGame(2, 36, { forceBattle: false });
  betAll(st6);
  E.applyAction(st6, 'p0', { type: 'stay' });
  E.applyAction(st6, 'p1', { type: 'stay' });
  check('dealer hole card is face-up after the round', st6.dealer.hand.every(c => c.faceUp === true));
}

console.log('Filtered views (hidden info):');
{
  const st = mkGame(3, 41, { forceBattle: false });
  betAll(st);
  // Rig every hand with distinct cards so a leak check for a specific
  // card id is airtight (no duplicates anywhere in the state).
  setHand(st, 'p0', [C('9', '♠'), C('8', '♥')]);
  setHand(st, 'p1', [C('5', '♠'), C('K', '♥')]); // hole card is K♥
  setHand(st, 'p2', [C('7', '♦'), C('6', '♣')]);
  setDealerHand(st, [C('9', '♦'), C('Q', '♣')]); // dealer hole is Q♣
  st.deck = Array(20).fill(C('2', '♠')); // low cards only: no K♥ / Q♣ anywhere else
  const v0 = E.viewFor(st, 'p0');
  const opp = v0.players.find(p => p.id === 'p1');
  check('another player hole card is {hidden:true}', opp.cards[1] && opp.cards[1].hidden === true && !('rank' in opp.cards[1]));
  check('another player first card is visible', opp.cards[0].rank === '5' && opp.cards[0].suit === '♠');
  check('hole card value never appears in another player view', !JSON.stringify(v0).includes('K♥'));
  check('own hand is fully visible, including the hole card', v0.players.find(p => p.id === 'p0').cards.every(c => c.rank !== null));
  check('dealer hole is hidden during play', v0.dealer.cards[1] && v0.dealer.cards[1].hidden === true);
  check('dealer hole value never appears in a player view', !JSON.stringify(v0).includes('Q♣'));
  check('dealer total is hidden during play', v0.dealer.total === null);
  check('other players totals are hidden during play', v0.players.find(p => p.id === 'p1').total === null);
  check('own total is visible', typeof v0.players.find(p => p.id === 'p0').total === 'number');
  check('deck is count-only (no order leaked)', v0.deckCount === st.deck.length && !('deck' in v0));
  // A special second card DOES appear to everyone.
  setHand(st, 'p1', [C('5', '♠'), SP(2)]);
  const v1 = E.viewFor(st, 'p0');
  check('a special second card is visible to everyone', v1.players.find(p => p.id === 'p1').cards[1].rank === 'SP');
  // The log never contains hole ranks.
  const logText = st.round.log.join(' ');
  check('log never contains hole-card ranks', !logText.includes('K♥') && !logText.includes('Q♣'));
  // Spectator sees every hole as hidden.
  const vs = E.viewFor(st, 'nobody');
  check('spectator sees only face-up cards', vs.players.every(p => p.cards.every(c => c.rank == null || c.faceUp === true)) &&
    vs.players.find(p => p.id === 'p0').cards[1].hidden === true);
  check('filteredView is an alias for viewFor', JSON.stringify(E.filteredView(st, 'p0')) === JSON.stringify(E.viewFor(st, 'p0')));
  // At settle, everything is revealed.
  playTurns(st, E.mulberry32(3));
  const vEnd = E.viewFor(st, 'p0');
  check('at settle the dealer hand is fully revealed', vEnd.dealer.cards.every(c => c.rank !== null));
  check('at settle every hand is revealed with totals', vEnd.players.every(p => typeof p.total === 'number'));
  check('results are visible at settle', vEnd.results !== null);
  check('round battle flag is exposed in the view', vEnd.round.battle === st.round.battle && 'battleWinnerId' in vEnd.round);
}

console.log('Leave / remove:');
{
  // Leave during betting: bet refunded.
  const st = mkGame(3, 51, { forceBattle: false });
  E.applyAction(st, 'p0', { type: 'placeBet', amount: 50 });
  const lr = E.leavePlayer(st, 'p0');
  check('leave during betting refunds the bet', lr.ok === true && E.playerById(st, 'p0').stack === 1000 && E.playerById(st, 'p0').left === true);
  check('betting continues for the rest', st.phase === 'betting');
  // Leave mid-round: cards return to the deck, bet stays lost.
  const st2 = mkGame(3, 52, { forceBattle: false });
  betAll(st2, { p0: 50, p1: 10, p2: 10 });
  const deckBefore = st2.deck.length;
  const lr2 = E.leavePlayer(st2, 'p1');
  check('leave mid-round returns cards to the deck', lr2.ok === true && st2.deck.length === deckBefore + 2);
  check('leave mid-round keeps the bet lost', E.playerById(st2, 'p1').stack === 990);
  check('leaver hand is empty', E.playerById(st2, 'p1').hand.length === 0);
  // Leave on your own turn: turn advances.
  const st3 = mkGame(3, 53, { forceBattle: false });
  betAll(st3);
  check('turn starts at p0', st3.turnPlayerId === 'p0');
  E.leavePlayer(st3, 'p0');
  check('leaving on your turn advances the turn', st3.turnPlayerId === 'p1');
  // Leave with no entrants left: round settles.
  const st4 = mkGame(2, 54, { forceBattle: false });
  betAll(st4, { p0: 10, p1: 'spectate' });
  E.leavePlayer(st4, 'p0');
  check('leaving the last entrant settles the round', st4.phase === 'settled');
  // Last player leaving ends the game.
  const st5 = mkGame(1, 55, { forceBattle: false });
  const lr5 = E.leavePlayer(st5, 'p0');
  check('last player leaving ends the game', lr5.ok === true && lr5.gameOver === true && st5.phase === 'over');
  check('removePlayer is an alias for leavePlayer', typeof E.removePlayer === 'function');
  check('leaving twice is an error', E.leavePlayer(st5, 'p0').ok === false);
  // Fingerprint is stable across serialize/deserialize.
  const st6 = mkGame(2, 56, { forceBattle: false });
  betAll(st6);
  check('fingerprint is stable for identical state', E.stateFingerprint(st6) === E.stateFingerprint(E.deserializeState(E.serializeState(st6))));
  check('fingerprint changes when the state changes', (() => { const a = E.stateFingerprint(st6); E.applyAction(st6, 'p0', { type: 'stay' }); return E.stateFingerprint(st6) !== a; })());
}

console.log('Bots:');
{
  // Bot never returns an illegal action over many seeded games.
  let illegal = 0, actions = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const st = mkGame(5, seed);
    const rnd = E.mulberry32(seed * 7919);
    let guard = 0;
    while (st.phase !== 'over' && guard++ < 200) {
      if (st.phase === 'betting') {
        for (const p of st.players.slice()) {
          if (p.left || p.decided) continue;
          const a = E.botChooseAction(st, p.id, rnd);
          actions++;
          if (a) { const r = E.applyAction(st, p.id, a); if (!r.ok) { illegal++; console.log('  illegal bot action', JSON.stringify(a), r.error); } }
        }
      } else if (st.phase === 'playerTurns') {
        const a = E.botChooseAction(st, st.turnPlayerId, rnd);
        actions++;
        if (!a) { illegal++; continue; }
        const r = E.applyAction(st, st.turnPlayerId, a);
        if (!r.ok) { illegal++; console.log('  illegal bot action', JSON.stringify(a), r.error); }
      } else if (st.phase === 'settled') {
        E.applyAction(st, 'p0', { type: 'nextRound', forceBattle: false });
      }
      if (guard > 190) break;
    }
  }
  check('bot never returns an illegal action over 60 seeded games (' + actions + ' actions)', illegal === 0, illegal + ' illegal');
  // Bot doubles on 11, hits on <=16, stays on 17+.
  const t = (cards, stack, bet) => {
    const s = mkGame(2, 61, { forceBattle: false });
    betAll(s, { p0: 10, p1: 10 });
    setHand(s, 'p0', cards);
    s.players[0].stack = stack === undefined ? 1000 : stack;
    s.players[0].bet = bet === undefined ? 10 : bet;
    return E.botChooseAction(s, 'p0', () => 0.99);
  };
  check('bot doubles on a 2-card 11', t([C('6', '♠'), C('5', '♥')]).type === 'double');
  check('bot doubles on a 2-card 10 half the time (rnd 0.99 -> no double, hits instead)', t([C('6', '♠'), C('4', '♥')]).type === 'hit');
  check('bot doubles on a 2-card 10 when the coin says so', t([C('6', '♠'), C('4', '♥')]) && E.botChooseAction((() => { const s = mkGame(2, 62, { forceBattle: false }); betAll(s, { p0: 10, p1: 10 }); setHand(s, 'p0', [C('6', '♠'), C('4', '♥')]); return s; })(), 'p0', () => 0.1).type === 'double');
  check('bot hits on 16', t([C('K', '♠'), C('6', '♥')]).type === 'hit');
  check('bot stays on 17', t([C('K', '♠'), C('7', '♥')]).type === 'stay');
  check('bot stays on 21', t([C('A', '♠'), C('K', '♥')]).type === 'stay');
  check('bot never hits with 5 cards', (() => {
    const s = mkGame(2, 63, { forceBattle: false });
    betAll(s, { p0: 10, p1: 10 });
    setHand(s, 'p0', [C('2', '♠'), C('2', '♥'), C('2', '♦'), C('3', '♣'), C('3', '♠')]);
    return E.botChooseAction(s, 'p0', () => 0).type === 'stay';
  })());
  check('bot does not double when it cannot afford it', (() => {
    const s = mkGame(2, 64, { forceBattle: false });
    betAll(s, { p0: 50, p1: 10 });
    setHand(s, 'p0', [C('6', '♠'), C('5', '♥')]);
    s.players[0].stack = 10;
    return E.botChooseAction(s, 'p0', () => 0.99).type === 'hit';
  })());
}

console.log('500-round bot soak:');
{
  let rounds = 0, throws = 0, negativeStacks = 0, overCap = 0, unterminated = 0;
  const st = mkGame(5, 2026);
  for (let round = 0; round < 500; round++) {
    try {
      const rnd = E.mulberry32(5000 + round);
      let guard = 0;
      while (st.phase === 'betting' && guard++ < 50) {
        for (const p of st.players.slice()) {
          if (p.left || p.decided) continue;
          if (p.stack === 0) { const rb = E.applyAction(st, p.id, { type: 'rebuy' }); if (!rb.ok) throw new Error('rebuy failed: ' + rb.error); }
          const a = E.botChooseAction(st, p.id, rnd);
          if (a) { const r = E.applyAction(st, p.id, a); if (!r.ok) throw new Error('betting action failed: ' + r.error); }
        }
        if (st.phase === 'betting' && st.players.filter(p => !p.left).every(p => p.decided)) throw new Error('stuck in betting');
      }
      if (st.phase === 'playerTurns') playTurns(st, rnd);
      if (st.phase !== 'settled') { unterminated++; throw new Error('round did not settle, phase=' + st.phase); }
      for (const p of st.players) {
        if (p.stack < 0) negativeStacks++;
        if (st.results && st.results[p.id] && st.results[p.id].payout > 1200) overCap++;
      }
      rounds++;
      if (round < 499) {
        const nx = E.applyAction(st, 'p0', { type: 'nextRound', forceBattle: round % 7 === 0 });
        if (!nx.ok) throw new Error('nextRound failed: ' + nx.error);
      }
    } catch (e) { throws++; console.log('  soak throw round ' + round + ': ' + e.message); break; }
  }
  check('soak completed 500 rounds', rounds === 500, rounds + ' rounds');
  check('soak never threw', throws === 0, throws + ' throws');
  check('soak never produced a negative stack', negativeStacks === 0);
  check('soak never paid out over 1200 in one round', overCap === 0);
  check('every soak round terminated', unterminated === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
