// Black Nyack fairness test: the game must be completely random, with no
// weighting toward Nyau. A fixed-seed Monte Carlo plays thousands of rounds
// with the bot's fixed strategy and asserts the outcomes land in the bands a
// fair blackjack game produces — deck composition, win/push/loss rates, the
// dealer's bust rate, a uniform special die, the 8% Battle Bonyas rate, and
// equal first-card values for dealer and player.
// Run: node test/fairness.test.js
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
const val = c => c.special ? 0 : (c.rank === 'A' ? 11 : (['J', 'Q', 'K'].includes(c.rank) ? 10 : parseInt(c.rank, 10)));

console.log('Fairness Monte Carlo (fixed seeds, so it is reproducible):');
{
  // the deck itself: a full 55, no card weighted, duplicated, or missing
  const deck = E.buildDeck();
  const rankCount = {};
  for (const c of deck) rankCount[c.rank] = (rankCount[c.rank] || 0) + 1;
  check('deck is 55 cards: 52 standard + 3 specials', deck.length === 55 && deck.filter(c => c.special).length === 3);
  check('every standard rank appears exactly 4 times', Object.entries(rankCount).filter(([r]) => r !== 'SP').every(([, n]) => n === 4));

  const ROUNDS = 2000;
  let wins = 0, pushes = 0, losses = 0, dealerBusts = 0, battles = 0;
  let dealerUpSum = 0, playerFirstSum = 0;
  const dieCount = { 0: 0, 1: 0, 2: 0 };
  let dieTotal = 0;
  for (let i = 0; i < ROUNDS; i++) {
    // a fixed seed per round: the same run always deals the same cards,
    // so this test is deterministic — and the seed is never reused across
    // rounds, so no round is a copy of another.
    const st = E.newGame([{ name: 'P', isBot: true }], 1000 + i, {});
    if (st.round.battle) battles++;
    E.applyAction(st, 'p0', { type: 'placeBet', amount: 10 });
    dealerUpSum += val(st.dealer.hand[0]);
    playerFirstSum += val(E.playerById(st, 'p0').hand[0]);
    let guard = 0;
    while (st.phase === 'playerTurns' && guard++ < 50) {
      const a = E.botChooseAction(st, 'p0');
      const r = E.applyAction(st, 'p0', a);
      if (!r.ok) throw new Error('bot action failed: ' + r.error);
    }
    if (st.phase === 'dealerTurn') E.dealerPlay(st);
    if (st.phase !== 'settled') throw new Error('expected settled, got ' + st.phase);
    const res = st.results['p0'];
    if (res.outcome === 'win') wins++;
    else if (res.outcome === 'push') pushes++;
    else losses++;
    if (E.bestValue(st.dealer.hand, st.round.specialTotal).bust) dealerBusts++;
    for (const roll of st.round.rolls) { dieCount[roll]++; dieTotal++; }
  }
  const winRate = wins / ROUNDS, pushRate = pushes / ROUNDS;
  const bustRate = dealerBusts / ROUNDS, battleRate = battles / ROUNDS;
  console.log('  ' + ROUNDS + ' rounds: win ' + (100 * winRate).toFixed(1) + '%, push ' + (100 * pushRate).toFixed(1) + '%, loss ' + (100 * losses / ROUNDS).toFixed(1) + '%, dealer busts ' + (100 * bustRate).toFixed(1) + '%, battles ' + (100 * battleRate).toFixed(1) + '%, die 0/1/2 ' + dieCount[0] + '/' + dieCount[1] + '/' + dieCount[2]);
  // the bands a fair blackjack game lands in (loose on purpose: the bot
  // plays a simple hit-<=16 strategy, so its win rate sits a little under
  // a perfect basic-strategy player — that is the bot, not the deck).
  check('win rate is in the fair band (35-50%)', winRate >= 0.35 && winRate <= 0.50, 'got ' + (100 * winRate).toFixed(1) + '%');
  check('push rate is in the fair band (4-15%)', pushRate >= 0.04 && pushRate <= 0.15, 'got ' + (100 * pushRate).toFixed(1) + '%');
  // the dealer only draws when a player is still standing, so his bust rate
  // here is unconditional (lower than the ~28% textbook rate for rounds he
  // actually plays) — the band covers that.
  check('dealer bust rate is in the fair band (12-30%)', bustRate >= 0.12 && bustRate <= 0.30, 'got ' + (100 * bustRate).toFixed(1) + '%');
  check('Battle Bonyas lands near its 8% design (4-13%)', battleRate >= 0.04 && battleRate <= 0.13, 'got ' + (100 * battleRate).toFixed(1) + '%');
  check('the special die is uniform (each face 25-42% of rolls)', [0, 1, 2].every(f => dieCount[f] / dieTotal >= 0.25 && dieCount[f] / dieTotal <= 0.42), JSON.stringify(dieCount));
  check('the dealer and the player are dealt equal first cards (no card bias)', Math.abs(dealerUpSum / ROUNDS - playerFirstSum / ROUNDS) < 0.5, 'dealer ' + (dealerUpSum / ROUNDS).toFixed(2) + ' vs player ' + (playerFirstSum / ROUNDS).toFixed(2));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
