// Black Nyack Battle Bonyas tests: odds, single winner, no winner,
// re-trigger across rounds, and battle bonus isolation.
// Run: node test/battle.test.js
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
function betAll(st, amounts) {
  for (const p of st.players.slice()) {
    const a = amounts ? amounts[p.id] : 10;
    const r = a === 'spectate'
      ? E.applyAction(st, p.id, { type: 'spectate' })
      : E.applyAction(st, p.id, { type: 'placeBet', amount: a });
    if (!r.ok) throw new Error('bet failed for ' + p.id + ': ' + r.error);
  }
  return st;
}
function playTurns(st, rnd) {
  let guard = 0;
  while (st.phase === 'playerTurns' && guard++ < 50) {
    const pid = st.turnPlayerId;
    const a = E.botChooseAction(st, pid, rnd);
    if (!a) throw new Error('bot returned no action for ' + pid);
    const r = E.applyAction(st, pid, a);
    if (!r.ok) throw new Error('bot action failed: ' + r.error);
  }
  // Nyau draws one card at a time — finish his turn, then the round settles.
  if (st.phase === 'dealerTurn') E.dealerPlay(st);
  return st;
}
/* Rig a settled round with a battle flag and given hands. */
function rigBattle(cfg) {
  const st = E.newGame(cfg.names || ['P0', 'P1', 'P2'], cfg.seed === undefined ? 42 : cfg.seed, { forceBattle: false });
  betAll(st, cfg.bets);
  for (const pid of Object.keys(cfg.hands)) setHand(st, pid, cfg.hands[pid]);
  setDealerHand(st, cfg.dealerHand);
  st.round.specialTotal = cfg.specialTotal || 0;
  st.round.battle = !!cfg.battle;
  E.settle(st);
  return st;
}

console.log('Battle odds:');
{
  check('BATTLE_ODDS is 0.08', E.BATTLE_ODDS === 0.08);
  check('forceBattle:true forces a battle round', E.newGame(['A', 'B'], 1, { forceBattle: true }).round.battle === true);
  check('forceBattle:false forces a normal round', E.newGame(['A', 'B'], 1, { forceBattle: false }).round.battle === false);
  check('a battle round is logged', E.newGame(['A', 'B'], 1, { forceBattle: true }).round.log.join(' ').includes('BATTLE BONYAS'));
  check('a normal round does not log a battle', !E.newGame(['A', 'B'], 1, { forceBattle: false }).round.log.join(' ').includes('BATTLE BONYAS'));
  // Statistical check: 500 seeded rounds should land well inside 8% ± noise.
  let battles = 0;
  for (let s = 0; s < 500; s++) if (E.newGame(['A', 'B'], s).round.battle) battles++;
  check('battle triggers sometimes across 500 seeded rounds (' + battles + '/500)', battles > 15 && battles < 80, battles + ' battles');
  check('battle does not trigger every round', battles < 500);
}

console.log('Single winner:');
{
  // Two winners: p0 has 21 (class 2), p1 has 20 (class 1). Only p0 gets the battle bonus.
  const st = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('A', '♠'), C('K', '♥')], p1: [C('K', '♦'), C('Q', '♣')] },
    dealerHand: [C('K', '♠'), C('8', '♥')], battle: true
  });
  check('battle winner is the best winning hand (p0, 21)', st.round.battleWinnerId === 'p0');
  check('winner gets +5x battle bonus', st.results['p0'].breakdown.battle === 50 && st.results['p0'].payout === 20 + 30 + 50, JSON.stringify(st.results['p0']));
  check('other winner gets a NORMAL payout only (no battle bonus)', st.results['p1'].outcome === 'win' && st.results['p1'].breakdown.battle === 0 && st.results['p1'].payout === 20, JSON.stringify(st.results['p1']));
  check('battle bonus does not leak to losers or spectators', !st.results['p2'] && st.results['p1'].breakdown.battle === 0);
  check('view exposes the battle winner', E.viewFor(st, 'p0').round.battleWinnerId === 'p0');
  // Ranking: same class + same total -> more specials wins.
  const st2 = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('K', '♠'), C('Q', '♥')], p1: [SP(1), C('K', '♦'), C('7', '♣')] },
    dealerHand: [C('K', '♣'), C('8', '♠')], specialTotal: 3, battle: true
  });
  // p0: 20 (class 1, 0 specials). p1: 3 + 10 + 7 = 20 (class 1, 1 special). p1 wins the battle.
  check('battle ranking prefers more specials on a tie', st2.round.battleWinnerId === 'p1', 'got ' + st2.round.battleWinnerId);
  // Ranking: full tie -> earliest seat wins.
  const st3 = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('K', '♠'), C('Q', '♥')], p1: [C('K', '♦'), C('Q', '♣')] },
    dealerHand: [C('K', '♣'), C('8', '♠')], battle: true
  });
  check('battle ranking on a full tie goes to the earliest seat', st3.round.battleWinnerId === 'p0');
  // Ranking: higher class beats higher total (5 cards beats 21).
  const st4 = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('A', '♠'), C('K', '♥')], p1: [C('2', '♠'), C('2', '♥'), C('3', '♦'), C('4', '♣'), C('5', '♠')] },
    dealerHand: [C('K', '♣'), C('8', '♠')], battle: true
  });
  check('battle ranking prefers the 5-card hand over a plain 21', st4.round.battleWinnerId === 'p1', 'got ' + st4.round.battleWinnerId);
}

console.log('No winner when the dealer wins:');
{
  // Dealer 21 beats everyone; battle is on but nobody beats the dealer.
  const st = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('K', '♠'), C('9', '♥')], p1: [C('K', '♦'), C('8', '♣')] },
    dealerHand: [C('A', '♠'), C('K', '♣')], battle: true
  });
  check('no battle winner when nobody beats the dealer', st.round.battleWinnerId === null);
  check('nobody gets a battle bonus', Object.values(st.results).every(r => r.breakdown.battle === 0));
  // Pushes do not count as beating the dealer.
  const st2 = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('K', '♠'), C('Q', '♥')], p1: [C('K', '♦'), C('8', '♣')] },
    dealerHand: [C('K', '♣'), C('Q', '♠')], battle: true
  });
  check('a push does not make a battle winner', st2.round.battleWinnerId === null && st2.results['p0'].outcome === 'push');
  // Everyone busts: no battle winner.
  const st3 = rigBattle({
    bets: { p0: 10, p1: 10, p2: 'spectate' },
    hands: { p0: [C('K', '♠'), C('Q', '♥'), C('5', '♦')], p1: [C('K', '♦'), C('Q', '♣'), C('6', '♠')] },
    dealerHand: [C('K', '♣'), C('8', '♠')], battle: true
  });
  check('no battle winner when everyone busts', st3.round.battleWinnerId === null);
}

console.log('Re-trigger across rounds:');
{
  const st = E.newGame(['A', 'B'], 7, { forceBattle: true });
  check('round 1 is a battle round (forced)', st.round.battle === true);
  betAll(st); playTurns(st, E.mulberry32(1));
  check('round 1 settles', st.phase === 'settled');
  const nx1 = E.applyAction(st, 'p0', { type: 'nextRound', forceBattle: false });
  check('round 2 opens with a fresh battle roll (forced off)', nx1.ok === true && st.round.battle === false);
  check('battle winner resets between rounds', st.round.battleWinnerId === null);
  check('special total resets between rounds', st.round.specialTotal === 0);
  betAll(st); playTurns(st, E.mulberry32(2));
  const nx2 = E.applyAction(st, 'p0', { type: 'nextRound', forceBattle: true });
  check('battle can trigger again the next round (forced on)', nx2.ok === true && st.round.battle === true);
  check('round number advances', st.roundNumber === 3);
  // A battle round lasts exactly one round: forcing it off next round clears it.
  betAll(st); playTurns(st, E.mulberry32(3));
  const nx3 = E.applyAction(st, 'p0', { type: 'nextRound', forceBattle: false });
  check('battle does not carry over to the following round', nx3.ok === true && st.round.battle === false);
}

console.log('Battle + cap interaction:');
{
  // Battle winner payout is capped at 1200 like any other payout.
  const st = rigBattle({
    bets: { p0: 50, p1: 10, p2: 'spectate' },
    hands: { p0: [SP(1), C('K', '♥'), C('K', '♦')], p1: [C('K', '♠'), C('Q', '♣')] },
    dealerHand: [C('K', '♣'), C('8', '♥')], specialTotal: 1, battle: true
  });
  // p0: doubled? No — plain 50 bet, 3-card 21 + 1 special + battle:
  // 2*50 + 3*50 + 2*50 + 5*50 = 600, under the cap, and p0 wins the battle.
  check('battle winner under the cap is paid in full', st.results['p0'].payout === 600 && st.round.battleWinnerId === 'p0', JSON.stringify(st.results['p0']));
  check('the other winner still gets a normal payout', st.results['p1'].payout === 20);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
