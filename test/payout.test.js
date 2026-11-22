// Black Nyack payout tests: the payout table + the four regression cases.
// Run: node test/payout.test.js
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
/* Rig a settled round:
   - bets: {pid: amount} placed for real (deducted from 1000 stacks);
   - hands: {pid: [cards]} rigged after the deal;
   - dealerHand: rigged dealer hand (must be 17+ or bust, so settle() is
     reached without the dealer drawing — settle() itself never draws);
   - specialTotal: the round's shared special value;
   - battle: whether this is a Battle Bonyas round;
   - doubled: {pid: true} — marks the bet as doubled (bet already doubled
     and the extra deducted by hand, as applyAction('double') would do).
   Returns {st, results}. */
function rigSettle(cfg) {
  const names = Object.keys(cfg.hands);
  const st = E.newGame(names, cfg.seed === undefined ? 42 : cfg.seed, { forceBattle: false });
  for (const p of st.players) {
    const amt = (cfg.bets || {})[p.id];
    if (amt === undefined) { const r = E.applyAction(st, p.id, { type: 'spectate' }); if (!r.ok) throw new Error('spectate failed: ' + r.error); }
    else { const r = E.applyAction(st, p.id, { type: 'placeBet', amount: amt }); if (!r.ok) throw new Error('placeBet failed: ' + r.error); }
  }
  if (st.phase !== 'playerTurns') throw new Error('expected playerTurns, got ' + st.phase);
  for (const pid of Object.keys(cfg.hands)) setHand(st, pid, cfg.hands[pid]);
  setDealerHand(st, cfg.dealerHand);
  st.round.specialTotal = cfg.specialTotal || 0;
  st.round.battle = !!cfg.battle;
  for (const pid of Object.keys(cfg.doubled || {})) {
    const p = E.playerById(st, pid);
    p.stack -= p.bet; p.bet *= 2; p.doubled = true; // the extra half of a double-down
  }
  E.settle(st);
  if (st.phase !== 'settled') throw new Error('expected settled, got ' + st.phase);
  return { st, results: st.results };
}

console.log('Payout table — wins:');
{
  // Plain win: 20 vs dealer 18, bet 10 -> 2*10 = 20, no bonuses.
  let r = rigSettle({ hands: { p0: [C('K', '♠'), C('Q', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('8', '♣')] });
  check('plain win pays 2x the bet', r.results['p0'].outcome === 'win' && r.results['p0'].payout === 20, JSON.stringify(r.results['p0']));
  check('plain win breakdown is win-only', JSON.stringify(r.results['p0'].breakdown) === JSON.stringify({ win: 20, blacknyack: 0, fiveCard: 0, special: 0, battle: 0 }));
  check('plain win credits the stack (1000 - 10 + 20)', E.playerById(r.st, 'p0').stack === 1010);
  // Dealer bust: 18 vs dealer bust -> win 2x.
  r = rigSettle({ hands: { p0: [C('K', '♠'), C('8', '♥')] }, bets: { p0: 20 },
    dealerHand: [C('K', '♦'), C('6', '♣'), C('9', '♠')] });
  check('dealer bust pays 2x the bet', r.results['p0'].outcome === 'win' && r.results['p0'].payout === 40);
  // Total 21 (3 cards) wins with the Blacknyack bonus: 2B + 3B.
  r = rigSettle({ hands: { p0: [C('7', '♠'), C('7', '♥'), C('7', '♦')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('3-card 21 pays 2x + 3x Blacknyack = 50 on a 10 bet', r.results['p0'].payout === 50 &&
    r.results['p0'].breakdown.win === 20 && r.results['p0'].breakdown.blacknyack === 30);
  // 2-card 21 (Black Nyack) vs dealer 20: same 2x + 3x.
  r = rigSettle({ hands: { p0: [C('A', '♠'), C('K', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('2-card 21 pays 2x + 3x Blacknyack = 50 on a 10 bet', r.results['p0'].payout === 50);
  // 5 cards under 21 beats even a dealer 21: 2B + 5B.
  r = rigSettle({ hands: { p0: [C('2', '♠'), C('2', '♥'), C('3', '♦'), C('4', '♣'), C('5', '♠')] }, bets: { p0: 10 },
    dealerHand: [C('A', '♦'), C('K', '♣')] });
  check('5 cards (16) beats a dealer 21, pays 2x + 5x = 70 on a 10 bet', r.results['p0'].outcome === 'win' && r.results['p0'].payout === 70 &&
    r.results['p0'].breakdown.fiveCard === 50);
  // 5 cards under 21 vs dealer 20: 2B + 5B.
  r = rigSettle({ hands: { p0: [C('2', '♠'), C('2', '♥'), C('3', '♦'), C('4', '♣'), C('5', '♠')] }, bets: { p0: 20 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('5 cards (16) vs dealer 20 pays 2x + 5x = 140 on a 20 bet', r.results['p0'].payout === 140);
  // One special card on a winning hand: +2B per special.
  // Special (worth 2) + King = 12 vs dealer 11 -> win.
  r = rigSettle({ hands: { p0: [SP(1), C('K', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('5', '♦'), C('6', '♣')], specialTotal: 2 });
  check('winning hand with 1 special pays 2x + 2x special = 40 on a 10 bet', r.results['p0'].payout === 40 &&
    r.results['p0'].breakdown.special === 20, JSON.stringify(r.results['p0']));
  // Two specials on a winning hand: +2B each.
  // Special + special (worth 2 each) + 9 = 13 vs dealer 11 -> win.
  r = rigSettle({ hands: { p0: [SP(1), SP(2), C('9', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('5', '♦'), C('6', '♣')], specialTotal: 2 });
  check('winning hand with 2 specials pays 2x + 2x + 2x = 60 on a 10 bet', r.results['p0'].payout === 60 &&
    r.results['p0'].breakdown.special === 40, JSON.stringify(r.results['p0']));
}

console.log('Payout table — push and lose:');
{
  let r = rigSettle({ hands: { p0: [C('K', '♠'), C('Q', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('equal totals push — stake back', r.results['p0'].outcome === 'push' && r.results['p0'].payout === 10);
  check('push credits the stake back (1000)', E.playerById(r.st, 'p0').stack === 1000);
  check('push gets no bonuses', r.results['p0'].breakdown.blacknyack === 0 && r.results['p0'].breakdown.fiveCard === 0 && r.results['p0'].breakdown.special === 0);
  // 2-card 21 vs dealer 2-card 21 is a push, not a win.
  r = rigSettle({ hands: { p0: [C('A', '♠'), C('K', '♥')] }, bets: { p0: 50 },
    dealerHand: [C('A', '♦'), C('K', '♣')] });
  check('21 vs 21 is a push (stake back, no Blacknyack bonus)', r.results['p0'].outcome === 'push' && r.results['p0'].payout === 50);
  // 5-card 21 vs dealer 5-card 21 is a push.
  r = rigSettle({ hands: { p0: [C('2', '♠'), C('3', '♥'), C('4', '♦'), C('5', '♣'), C('7', '♠')] }, bets: { p0: 50 },
    dealerHand: [C('2', '♦'), C('3', '♣'), C('4', '♠'), C('5', '♥'), C('7', '♦')] });
  check('5-card 21 vs dealer 5-card 21 is a push', r.results['p0'].outcome === 'push' && r.results['p0'].payout === 50);
  // Lower total loses.
  r = rigSettle({ hands: { p0: [C('K', '♠'), C('8', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('18 vs dealer 20 loses, payout 0', r.results['p0'].outcome === 'lose' && r.results['p0'].payout === 0);
  check('loser keeps the deducted bet (990)', E.playerById(r.st, 'p0').stack === 990);
  // Player bust loses even if the dealer also busts.
  r = rigSettle({ hands: { p0: [C('K', '♠'), C('Q', '♥'), C('5', '♦')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('6', '♣'), C('9', '♠')] });
  check('player bust loses even when the dealer busts too', r.results['p0'].outcome === 'lose' && r.results['p0'].payout === 0);
  // A special card on a LOSING hand pays no special bonus.
  r = rigSettle({ hands: { p0: [SP(1), C('5', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('Q', '♣')], specialTotal: 2 });
  check('losing hand with a special pays 0 and no special bonus', r.results['p0'].payout === 0 && r.results['p0'].breakdown.special === 0);
  // A 5-card hand loses to nothing but a better class: 5 cards (16) vs dealer 17 loses? No — class 3 beats class 1.
  r = rigSettle({ hands: { p0: [C('2', '♠'), C('2', '♥'), C('3', '♦'), C('4', '♣'), C('5', '♠')] }, bets: { p0: 10 },
    dealerHand: [C('K', '♦'), C('7', '♣')] });
  check('5 cards (16) beats a dealer 17 by class', r.results['p0'].outcome === 'win');
  // Normal 21 loses to a dealer 5-card hand (class 3 > class 2).
  r = rigSettle({ hands: { p0: [C('A', '♠'), C('K', '♥')] }, bets: { p0: 10 },
    dealerHand: [C('2', '♦'), C('2', '♣'), C('3', '♠'), C('4', '♥'), C('5', '♦')] });
  check('plain 21 loses to a dealer 5-card hand', r.results['p0'].outcome === 'lose' && r.results['p0'].payout === 0);
}

console.log('REGRESSION (a): bet 50, 5-card 21, no battle, no special -> 500:');
{
  const r = rigSettle({ hands: { p0: [C('2', '♠'), C('3', '♥'), C('4', '♦'), C('5', '♣'), C('7', '♠')] }, bets: { p0: 50 },
    dealerHand: [C('K', '♦'), C('Q', '♣')] });
  check('payout is exactly 500', r.results['p0'].payout === 500, 'got ' + r.results['p0'].payout);
  check('breakdown is 2x50 win + 3x50 blacknyack + 5x50 five-card',
    r.results['p0'].breakdown.win === 100 && r.results['p0'].breakdown.blacknyack === 150 &&
    r.results['p0'].breakdown.fiveCard === 250 && r.results['p0'].breakdown.special === 0 &&
    r.results['p0'].breakdown.battle === 0, JSON.stringify(r.results['p0'].breakdown));
  check('stack is 1000 - 50 + 500 = 1450', E.playerById(r.st, 'p0').stack === 1450);
}

console.log('REGRESSION (b): bet 50 DOUBLED (B=100), 3-card 21, 1 special, battle winner -> 1200:');
{
  // Hand: special (worth 1) + K + K = 21. Dealer 20. Battle on, single winner.
  const r = rigSettle({ hands: { p0: [SP(1), C('K', '♥'), C('K', '♦')] }, bets: { p0: 50 },
    doubled: { p0: true }, dealerHand: [C('K', '♣'), C('Q', '♠')], specialTotal: 1, battle: true });
  check('payout is exactly 1200', r.results['p0'].payout === 1200, 'got ' + r.results['p0'].payout);
  check('breakdown is 2x100 win + 3x100 blacknyack + 2x100 special + 5x100 battle',
    r.results['p0'].breakdown.win === 200 && r.results['p0'].breakdown.blacknyack === 300 &&
    r.results['p0'].breakdown.fiveCard === 0 && r.results['p0'].breakdown.special === 200 &&
    r.results['p0'].breakdown.battle === 500, JSON.stringify(r.results['p0'].breakdown));
  check('player is the battle winner', r.results['p0'].battleWinner === true && r.st.round.battleWinnerId === 'p0');
  check('uncapped total is 1200 (no cap applied here)', r.results['p0'].uncapped === 1200 && r.results['p0'].capped === false);
}

console.log('REGRESSION (c): same as (b) but WITHOUT battle -> 700:');
{
  const r = rigSettle({ hands: { p0: [SP(1), C('K', '♥'), C('K', '♦')] }, bets: { p0: 50 },
    doubled: { p0: true }, dealerHand: [C('K', '♣'), C('Q', '♠')], specialTotal: 1, battle: false });
  check('payout is exactly 700', r.results['p0'].payout === 700, 'got ' + r.results['p0'].payout);
  check('breakdown is 2x100 win + 3x100 blacknyack + 2x100 special, no battle',
    r.results['p0'].breakdown.win === 200 && r.results['p0'].breakdown.blacknyack === 300 &&
    r.results['p0'].breakdown.special === 200 && r.results['p0'].breakdown.battle === 0);
  check('no battle winner without battle', r.st.round.battleWinnerId === null);
}

console.log('REGRESSION (d): doubled 3-card 21, TWO specials, battle winner -> 1400 uncapped, capped to 1200:');
{
  // Hand: special + special (worth 5 each) + Ace (11) = 21. Dealer 20.
  const r = rigSettle({ hands: { p0: [SP(1), SP(2), C('A', '♥')] }, bets: { p0: 50 },
    doubled: { p0: true }, dealerHand: [C('K', '♣'), C('Q', '♠')], specialTotal: 5, battle: true });
  check('uncapped total is 1400', r.results['p0'].uncapped === 1400, 'got ' + r.results['p0'].uncapped);
  check('payout is capped to exactly 1200', r.results['p0'].payout === 1200, 'got ' + r.results['p0'].payout);
  check('capped flag is set', r.results['p0'].capped === true);
  check('breakdown is 2x100 + 3x100 + 2x100x2 specials + 5x100 battle',
    r.results['p0'].breakdown.win === 200 && r.results['p0'].breakdown.blacknyack === 300 &&
    r.results['p0'].breakdown.special === 400 && r.results['p0'].breakdown.battle === 500);
  // Same hand without battle: 900, under the cap.
  const r2 = rigSettle({ hands: { p0: [SP(1), SP(2), C('A', '♥')] }, bets: { p0: 50 },
    doubled: { p0: true }, dealerHand: [C('K', '♣'), C('Q', '♠')], specialTotal: 5, battle: false });
  check('same hand without battle pays 900 (under the cap)', r2.results['p0'].payout === 900, 'got ' + r2.results['p0'].payout);
}

console.log('Cap — non-battle case:');
{
  // Doubled 5-card 21 with 2 specials, no battle: 200+300+500+400 = 1400 -> 1200.
  const r = rigSettle({ hands: { p0: [SP(1), SP(2), C('7', '♥'), C('5', '♦'), C('5', '♣')] }, bets: { p0: 50 },
    doubled: { p0: true }, dealerHand: [C('K', '♣'), C('Q', '♠')], specialTotal: 2, battle: false });
  check('5-card 21 + 2 specials doubled is capped at 1200', r.results['p0'].payout === 1200 && r.results['p0'].uncapped === 1400, 'got ' + r.results['p0'].payout);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
