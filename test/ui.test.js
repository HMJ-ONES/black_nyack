// Black Nyack UI smoke test (jsdom, no browser needed).
// Drives a real local game through the DOM: bet chips, spectate, hit/stay,
// hole-card peek, WIN dialog, next round, break-the-legs button, music
// elements + track selection, layout helpers, rules modal.
// Run: node test/ui.test.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {}); // swallow "HTMLMediaElement.play not implemented" noise
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  const $ = id => window.document.getElementById(id);
  const ev = src => window.eval(src);
  await new Promise(r => { if (window.document.readyState === 'complete') r(); else window.addEventListener('load', r); });

  /* ---- static checks: every screen / panel / button exists ---- */
  check('menu screen exists', !!$('menuScreen'));
  check('lobby screen exists', !!$('lobbyScreen'));
  check('game screen exists', !!$('gameScreen'));
  check('round table exists', !!$('tableWrap'));
  check('dealer SVG exists', !!$('dealerSvg'));
  check('dealer legs group exists', !!$('dealerLegs'));
  check('baseball bat element exists', !!$('bat'));
  check('taunt bubble exists', !!$('tauntBubble'));
  check('taunt bubble starts hidden — it only appears when he speaks', $('tauntBubble').classList.contains('hidden'));
  check('bet list sits above the table, not on the felt', !$('tableWrap').contains($('betList')) && $('tableTopbar').contains($('betList')));
  check('special box sits above the table, not on the felt', !$('tableWrap').contains($('specialBox')) && $('tableTopbar').contains($('specialBox')));
  check('log sits below the chips and buttons, so it never pushes them down', (() => {
    const kids=[...$('gameScreen').children];
    return kids.indexOf($('logBox')) > kids.indexOf($('actionBox')) && kids.indexOf($('logBox')) > kids.indexOf($('betBox'));
  })());
  check('log has a visible GAME LOG label right above it', !!$('logLabel') && $('logLabel').textContent.includes('GAME LOG') && [...$('gameScreen').children].indexOf($('logLabel')) === [...$('gameScreen').children].indexOf($('logBox')) - 1);
  check('special box has a die, hidden until a ★ is dealt', !!$('specialDie') && $('specialDieWrap').classList.contains('hidden'));
  check('break-legs button sits next to Nyau inside the table', $('dealerZone').contains($('breakLegsBtn')) && $('breakLegsBtn').classList.contains('break-mini'));
  check('break-legs button exists', !!$('breakLegsBtn'));
  check('no legs counter line on the table', !$('legsCount'));
  check('special card box exists', !!$('specialBox'));
  check('bet list exists', !!$('betList'));
  check('dealer hand area exists', !!$('dealerHand'));
  check('bet panel exists', !!$('betBox'));
  check('action panel exists', !!$('actionBox'));
  check('hit / stay / double buttons exist', !!$('btnHit') && !!$('btnStay') && !!$('btnDouble'));
  check('next round button exists', !!$('btnNextRound'));
  check('rebuy button exists', !!$('btnRebuy'));
  check('leave match button exists', !!$('btnLeaveMatch'));
  check('WIN dialog exists', !!$('winModal'));
  check('rules modal exists', !!$('rulesModal'));
  check('bot picker modal exists', !!$('botModal'));
  check('room options modal exists', !!$('roomOptModal'));
  check('music toggle exists', !!$('musicToggle'));
  check('log box exists', !!$('logBox'));
  check('battle banner exists', !!$('battleBanner'));

  /* ---- music: the two songs, correct files, looped ---- */
  check('main song element points at music.mp3', $('musicMain').getAttribute('src') === 'music.mp3');
  check('battle song element points at battle.mp3', $('musicBattle').getAttribute('src') === 'battle.mp3');
  check('both songs loop', $('musicMain').loop === true && $('musicBattle').loop === true);
  check('battle round picks the battle song', ev(`musicTrackFor(true)`) === 'battle.mp3');
  check('normal round picks the main loop', ev(`musicTrackFor(false)`) === 'music.mp3');
  check('music starts on', ev(`musicOn`) === true);

  /* ---- layout helpers (pure functions) ---- */
  check('landscape desktop is the round table', ev(`layoutModeFor(1200, 700)`) === 'round');
  check('portrait phone is stacked', ev(`layoutModeFor(500, 900)`) === 'stacked');
  check('narrow landscape is stacked', ev(`layoutModeFor(600, 400)`) === 'stacked');
  check('5 seats on the arc', ev(`seatPositionsFor(5).length`) === 5);
  check('middle seat sits bottom-center', ev(`seatPositionsFor(5)[2].x`) === 50);
  check('arc seats stay inside the table', ev(`seatPositionsFor(5).every(p=>p.x>10&&p.x<90&&p.y>40&&p.y<90)`));
  check('solo seat sits bottom-center', ev(`seatPositionsFor(1)[0].x`) === 50);

  /* ---- rules modal ---- */
  $('btnRules').click();
  check('rules modal opens', !$('rulesModal').classList.contains('hidden'));
  check('rules mention Battle Bonyas', /Battle Bonyas/.test($('rulesBody').textContent));
  check('rules show the 1200 cap', /1200/.test($('rulesBody').textContent));
  check('rules mention the special die', /special die/i.test($('rulesBody').textContent));
  check('rules mention breaking his legs', /Break his legs/.test($('rulesBody').textContent));
  $('rulesClose').click();
  check('rules modal closes', $('rulesModal').classList.contains('hidden'));

  /* ---- scenario 0: menu flow through the real buttons ---- */
  check('create lobby without PeerJS warns instead of breaking', (() => {
    $('btnCreate').click();
    return /multiplayer library/.test($('menuMsg').textContent);
  })());
  $('btnBots').click();
  check('bot picker opens from the menu', !$('botModal').classList.contains('hidden'));
  check('bot picker offers 0–4 bots', window.document.querySelectorAll('#botPick button').length === 5);
  [...window.document.querySelectorAll('#botPick button')].find(b => b.textContent.trim() === '1').click();
  check('picking 1 bot starts a local game', !$('gameScreen').classList.contains('hidden') && ev(`view.phase`) === 'betting');
  $('btnMenu2').click();
  check('back to menu works', !$('menuScreen').classList.contains('hidden') && $('gameScreen').classList.contains('hidden'));

  /* ---- scenario 1: a full round through the DOM (me + 1 bot) ---- */
  window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
  check('game screen shows', !$('gameScreen').classList.contains('hidden'));
  check('phase is betting', ev(`view.phase`) === 'betting');
  check('bet panel shows in betting phase', !$('betBox').classList.contains('hidden'));
  check('5 bet chips offered', window.document.querySelectorAll('#betChips .chip').length === 5);
  check('bet chips are 5/10/20/40/50', [...window.document.querySelectorAll('#betChips .chip')].map(b => b.textContent.trim()).join(',') === '5,10,20,40,50');
  check('bet list shows both players', window.document.querySelectorAll('#betList .bl-row').length === 2);
  check('special box starts at 0', $('specialTotal').textContent === '0');
  // Bet 20 via the real chip button.
  [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
  check('my bet is 20', ev(`view.players.find(p=>p.id===myId).bet`) === 20);
  check('my stack dropped by 20', ev(`view.players.find(p=>p.id===myId).stack`) === 980);
  check('bet panel hides once I decided', $('betBox').classList.contains('hidden'));
  // Bot answers its bet directly (its timer would do the same).
  ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
  ev(`refreshView(); render();`);
  check('cards are dealt after both bets', ev(`view.phase`) === 'playerTurns');
  check('I was dealt 2 cards', ev(`view.players.find(p=>p.id===myId).cards.length`) === 2);
  check('dealer was dealt 2 cards', ev(`view.dealer.cards.length`) === 2);
  check('my turn — action panel shows', !$('actionBox').classList.contains('hidden'));
  check('double down is offered with 2 cards', !$('btnDouble').disabled);
  check('hit is offered', !$('btnHit').disabled);
  // Hole card: my 2nd card is face-down unless it is a special.
  const hole = window.document.querySelector('#myCards [data-hole]');
  const mySecond = ev(`view.players.find(p=>p.id===myId).cards[1]`);
  if (hole) {
    check('hole card renders face-down', hole.classList.contains('back'));
    hole.click();
    check('tapping the hole card peeks at it', !window.document.querySelector('#myCards [data-hole]'));
    check('peeked card shows its rank', /[0-9JQKA]/.test(window.document.querySelector('#myCards').textContent));
  } else {
    check('no hole element means 2nd card is a face-up special', mySecond && mySecond.special === true);
  }
  // Stay via the real button.
  $('btnStay').click();
  check('my turn ends after Stay', ev(`view.players.find(p=>p.id===myId).stood`) === true);
  // Bot finishes its turn directly.
  ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
  ev(`refreshView(); render();`);
  // If the bot hit and is still to move, drive it until its turn ends.
  for (let i = 0; i < 5 && ev(`view.phase`) === 'playerTurns'; i++) {
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
  }
  // Nyau draws one card at a time (the driver steps him in real play);
  // the test finishes his turn at once with the synchronous wrapper.
  if (ev(`view.phase`) === 'dealerTurn') { ev(`dealerPlay(fullState); refreshView(); render();`); }
  check('round settles', ev(`view.phase`) === 'settled');
  check('results exist for me', !!ev(`view.results`) && !!ev(`view.results[myId]`));
  // v1.7: the dealer drew one card at a time during his turn, so by the
  // settle every dealer card is already showing — the reveal is just the
  // beat to look at the finished table before the results come out.
  check('all dealer cards are showing at the settle', (() => {
    const cards = window.document.querySelectorAll('#dealerHand .mini-card');
    const backs = window.document.querySelectorAll('#dealerHand .mini-card.back');
    return cards.length === ev(`view.dealer.cardCount`) && backs.length === 0;
  })());
  check('WIN dialog does NOT open at settle', $('winModal').classList.contains('hidden'));
  check('Next round does NOT show during the reveal', $('btnNextRound').classList.contains('hidden'));
  check('log hides the settle lines during the reveal', !$('logBox').textContent.includes('wins') && !$('logBox').textContent.includes('loses'));
  ev(`showSettleResults()`);
  check('dealer total is revealed after the look', /DEALER — \d+/.test($('dealerHand').textContent));
  check('WIN dialog does NOT open before the win text has had its beat', $('winModal').classList.contains('hidden'));
  ev(`openSettleDialog()`);
  check('WIN dialog shows after the reveal', !$('winModal').classList.contains('hidden'));
  check('WIN dialog shows the acquired total', /Acquired/.test($('winBody').textContent));
  ev(`clearRevealTimers()`); // no stray reveal timers may fire into later scenarios
  $('winClose').click();
  check('WIN dialog closes', $('winModal').classList.contains('hidden'));
  // Next round via the real button.
  $('btnNextRound').click();
  check('next round opens betting again', ev(`view.phase`) === 'betting' && ev(`view.roundNumber`) === 2);
  check('bet panel shows again next round', !$('betBox').classList.contains('hidden'));

  /* ---- scenario 2: spectate this round, auto-offered next round ----
     (A dead round can happen if the bot spectates too — then my decision
     resets and I spectate again; the bot re-rolls after a dead round.) */
  $('btnSpectate').click();
  check('I am spectating', ev(`view.players.find(p=>p.id===myId).spectating`) === true);
  check('bet panel hides while spectating', $('betBox').classList.contains('hidden'));
  let guard = 0;
  while (ev(`view.phase`) === 'betting' && guard++ < 10) {
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    if (ev(`view.phase`) === 'betting' && !ev(`view.players.find(p=>p.id===myId).spectating`)) $('btnSpectate').click();
  }
  check('bot plays alone while I spectate', ev(`view.phase`) === 'settled' || ev(`view.phase`) === 'playerTurns' || ev(`view.phase`) === 'dealerTurn');
  for (let i = 0; i < 5 && ev(`view.phase`) === 'playerTurns'; i++) {
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
  }
  if (ev(`view.phase`) === 'dealerTurn') { ev(`dealerPlay(fullState); refreshView(); render();`); }
  check('spectated round settles', ev(`view.phase`) === 'settled');
  check('no WIN dialog for a spectator', $('winModal').classList.contains('hidden'));
  // the round still has to be revealed before it can move on
  ev(`showSettleResults(); openSettleDialog(); clearRevealTimers();`);
  check('Next round shows once the results are out', !$('btnNextRound').classList.contains('hidden'));
  $('btnNextRound').click();
  check('spectator is offered entry again next round', ev(`view.phase`) === 'betting' && !$('betBox').classList.contains('hidden'));

  /* ---- scenario 3: break his legs — anytime, infinitely; bat hides after
     2s, legs grow back after a few minutes (both driven by named functions
     the test can call directly instead of waiting on real timers) ---- */
  check('legs start unbroken', ev(`legBreaks`) === 0);
  ev(`tauntChance=1`); // the bubble only speaks sometimes — force it for this check
  $('breakLegsBtn').click();
  $('breakLegsBtn').click();
  $('breakLegsBtn').click();
  check('three bat swings counted', ev(`legBreaks`) === 3);
  check('dealer legs show broken', $('dealerLegs').classList.contains('broken'));
  check('bat swung', $('bat').classList.contains('swing'));
  check('dealer face shows pain while legs are broken', $('dealerSvg').classList.contains('pain'));
  check('dealer yelps in pain when his legs are broken — a pain line, only sometimes', (() => {
    const t = $('tauntBubble').textContent;
    return ev(`PAIN_LINES.includes(${JSON.stringify(t)})`);
  })());
  ev(`hideBat()`);
  check('bat disappears after the hit (hideBat)', !$('bat').classList.contains('swing'));
  check('legs counter is a lifetime total even after healing', (() => {
    ev(`healLegs()`);
    return ev(`legBreaks`) === 3 && !$('dealerLegs').classList.contains('broken');
  })());
  check('dealer face leaves pain once legs heal', !$('dealerSvg').classList.contains('pain'));
  ev(`tauntChance=0.35`); // back to the game's rarely-speaks default

  /* ---- scenario 4: solo game (0 bots) works ---- */
  window.eval(`startLocalGame([{name:'Solo',isBot:false}], 7, {})`);
  check('solo game starts in betting', ev(`view.phase`) === 'betting');
  check('solo table has one seat', ev(`view.players.length`) === 1);
  [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '5').click();
  check('solo player is dealt in alone', ev(`view.phase`) === 'playerTurns' && ev(`view.turnPlayerId`) === ev(`myId`));

  /* ---- scenario 5: forced Battle Bonyas round ---- */
  window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 99, {forceBattle:true})`);
  check('battle round is flagged', ev(`view.round.battle`) === true);
  check('battle banner shows', !$('battleBanner').classList.contains('hidden'));
  check('battle banner says BATTLE BONYAS', /BATTLE BONYAS/.test($('battleBanner').textContent));
  check('battle song is the selected track', ev(`musicTrackFor(view.round.battle)`) === 'battle.mp3');
  check('battle track is active after match start', ev(`currentTrack`) === 'battle.mp3');
  check('battle round does not make him speak — the banner announces it', (() => {
    ev(`tauntChance=1`); ev(`hideBubble()`); ev(`render()`);
    return $('tauntBubble').classList.contains('hidden');
  })());
  ev(`tauntChance=0.35`);

  /* ---- scenario 6: v1.1 — Nyau, sometimes-only taunts, faces, coin rain ---- */
  check('footer credits SEGA', /SEGA/.test(window.document.body.textContent));
  check('footer says fan-made, no rights held', /fan-made/i.test(window.document.body.textContent) && /no rights/i.test(window.document.body.textContent));
  check('dealer art is labelled Nyau', /Nyau/.test($('dealerSvg').getAttribute('aria-label') || ''));
  check('coin layer exists', !!$('coinLayer'));
  // Taunts: rarely, not every time — gated by tauntChance; the bubble
  // only appears when he speaks and goes away a few seconds later.
  check('taunt chance defaults to 0.35', ev(`TAUNT_CHANCE`) === 0.35);
  check('dealer stays quiet when tauntChance is 0', (() => {
    const before = $('tauntBubble').textContent;
    ev(`tauntChance=0`); ev(`dealerSay('idle')`);
    return $('tauntBubble').textContent === before;
  })());
  check('dealer speaks when tauntChance is 1', (() => {
    ev(`tauntChance=1`); ev(`dealerSay('idle')`);
    return ev(`TAUNTS.general.includes($('tauntBubble').textContent)`);
  })());
  check('bubble appears when he speaks', !$('tauntBubble').classList.contains('hidden'));
  check('bubble goes away (hideBubble)', (() => {
    ev(`hideBubble()`);
    return $('tauntBubble').classList.contains('hidden');
  })());
  ev(`tauntChance=0.35`);
  // Banners: red BUST, shining golden DOUBLE DOWN, WIN! with the amount.
  check('bust banner is red BUST', (() => {
    const h = ev(`bannerFor({busted:true,cards:[],total:25})`);
    return /BUST/.test(h) && /bust/.test(h);
  })());
  check('double-down banner is golden DOUBLE DOWN', (() => {
    const h = ev(`bannerFor({busted:false,cards:[{},{}],total:11,doubled:true})`);
    return /DOUBLE DOWN/.test(h) && /gold/.test(h);
  })());
  check('win banner shows the amount, short and clear', (() => {
    ev(`view={phase:'settled',results:{me:{outcome:'win',payout:500,battleWinner:false}},round:{specialTotal:0,battle:false}}`);
    ev(`resultsShown=true`); // the banner only shows once the reveal is done
    const h = ev(`bannerFor({id:'me',busted:false,cards:[{},{},{}],total:20,doubled:false})`);
    return /WIN!/.test(h) && /\+500/.test(h);
  })());
  check('win banner stays hidden during the reveal', (() => {
    ev(`resultsShown=false`);
    const h = ev(`bannerFor({id:'me',busted:false,cards:[{},{},{}],total:20,doubled:false})`);
    return !/WIN!/.test(h);
  })());
  ev(`resultsShown=true`);
  // Coin rain scales with the win.
  check('coin rain: small win rains coins', (() => {
    ev(`$('coinLayer').innerHTML=''`);
    const n = ev(`coinBurstFor(100)`);
    return n >= 8 && window.document.querySelectorAll('#coinLayer .coin-fall').length === n;
  })());
  check('coin rain: bigger win rains more coins', (() => {
    ev(`$('coinLayer').innerHTML=''`);
    const small = ev(`coinBurstCount(100)`);
    const big = ev(`coinBurstCount(1200)`);
    return big > small && big <= 48;
  })());
  // Faces: sad when he loses, pain when his legs are broken.
  check('dealer face can be sad', (() => { ev(`setDealerFace('sad')`); return $('dealerSvg').classList.contains('sad'); })());
  check('dealer face can be in pain', (() => { ev(`setDealerFace('pain')`); return $('dealerSvg').classList.contains('pain') && !$('dealerSvg').classList.contains('sad'); })());
  check('dealer face goes back to normal after 7s (resetDealerFace)', (() => { ev(`resetDealerFace()`); return !$('dealerSvg').classList.contains('sad') && !$('dealerSvg').classList.contains('pain'); })());
  check('dealer face can be happy again', (() => { ev(`setDealerFace('happy')`); return !$('dealerSvg').classList.contains('sad') && !$('dealerSvg').classList.contains('pain'); })());
  check('face resets after 7 seconds', ev(`FACE_RESET_MS`) === 7000);
  check('bubble hides after 6 seconds', ev(`BUBBLE_HIDE_MS`) === 6000);
  check('idle chatter at most once a minute', ev(`TAUNT_IDLE_MS`) === 60000);
  check('win screen holds 8s before auto-advance', ev(`WIN_HOLD_MS`) === 8000);
  check('legs regrow after 3 minutes', ev(`LEG_REGEN_MS`) === 3 * 60 * 1000);
  check('bat vanishes 2s after the hit', ev(`BAT_HIDE_MS`) === 2000);

  /* ---- scenario 7: v1.3 — the special die rolls and lands; log below the chips ---- */
  check('die shows face 2 (two pips)', (() => { ev(`setDieFace(2)`); return $('specialDie').classList.contains('face-2'); })());
  check('die shows face 1 (one pip)', (() => { ev(`setDieFace(1)`); return $('specialDie').classList.contains('face-1'); })());
  check('die shows face 0 (blank)', (() => { ev(`setDieFace(0)`); return $('specialDie').classList.contains('face-0') && !$('specialDie').classList.contains('face-1') && !$('specialDie').classList.contains('face-2'); })());
  check('die tumbles when a roll is queued', (() => {
    ev(`queueDieRoll(2)`);
    return !$('specialDieWrap').classList.contains('hidden') && $('specialDie').classList.contains('rolling');
  })());
  check('die lands on the rolled face (landDie)', (() => { ev(`landDie(2)`); return $('specialDie').classList.contains('face-2') && !$('specialDie').classList.contains('rolling'); })());
  check('a fresh roll in the round makes the die roll', (() => {
    // start a real game first: scenario 6 replaced view with a stub that has no log
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 99, {forceBattle:false})`);
    ev(`rollSpecialDie(fullState, 'Ada'); refreshView();`);
    ev(`hideDie()`); ev(`render()`);
    return !$('specialDieWrap').classList.contains('hidden') && $('specialDie').classList.contains('rolling');
  })());
  check('die hides again on a new round', (() => {
    ev(`nextRound(fullState); refreshView(); render();`); // a real new round: fresh empty roll list, so nothing re-queues
    return $('specialDieWrap').classList.contains('hidden');
  })());
  check('die tumbles about 0.75s before landing', ev(`DIE_ROLL_MS`) === 750);

  /* ---- scenario 8: v1.4 — general taunts, no Hit/Double at 21, the
     dealer reveal, the six-sided die ---- */
  // Taunts: one general pool, no line about any specific event — the bubble
  // is not synced to the game state, so an event line would show up on the
  // wrong screen at the wrong time.
  check('taunts are one general pool', JSON.stringify(ev(`Object.keys(TAUNTS)`)) === '["general"]');
  check('taunt pool has plenty of lines', ev(`TAUNTS.general.length`) >= 10);
  check('no taunt line mentions a game event', !/bust|21|five card|double down|special|battle|legs|losing|you lost|you won|winner|blackjack/i.test(ev(`TAUNTS.general.join(' ')`)));
  check('a bust moment still speaks a general line', (() => {
    ev(`tauntChance=1`); ev(`dealerSay('bust')`);
    return ev(`TAUNTS.general.includes($('tauntBubble').textContent)`);
  })());
  check('a legs moment speaks a pain line', (() => {
    ev(`dealerSay('legs')`);
    return ev(`PAIN_LINES.includes($('tauntBubble').textContent)`);
  })());
  ev(`tauntChance=0.35`);
  // No Hit / Double Down at 21 (UI helper).
  check('actionsFor: at 21 neither Hit nor Double is offered', (() => {
    const a = ev(`actionsFor({cards:[{},{}],total:21,stack:1000,bet:10})`);
    return a.hit === false && a.dbl === false;
  })());
  check('actionsFor: at 20 both are offered', (() => {
    const a = ev(`actionsFor({cards:[{},{}],total:20,stack:1000,bet:10})`);
    return a.hit === true && a.dbl === true;
  })());
  check('Hit and Double Down are disabled on 21 in the real panel', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 99, {forceBattle:false})`);
    ev(`myId='me'`);
    ev(`view={phase:'playerTurns',turnPlayerId:'me',roundNumber:1,round:{specialTotal:0,battle:false},version:1,deckCount:40,results:null,log:['Black Nyack — round 1.'],dealer:{cardCount:2,total:null,cards:[{rank:'9',suit:'♣',special:false,faceUp:true},{hidden:true}]},players:[{id:'me',name:'Test',isBot:false,seat:0,stack:1000,bet:10,doubled:false,stood:false,busted:false,spectating:false,left:false,cardCount:2,total:21,cards:[{rank:'A',suit:'♠',special:false,faceUp:true},{rank:'K',suit:'♥',special:false,faceUp:true}]},{id:'bot',name:'Ada',isBot:true,seat:1,stack:1000,bet:10,doubled:false,stood:false,busted:false,spectating:false,left:false,cardCount:2,total:null,cards:[{hidden:true},{hidden:true}]}]}`);
    ev(`render()`);
    return $('btnHit').disabled && $('btnDouble').disabled && /Stay/.test($('actionPrompt').textContent) && /21 in hand/.test($('statusBox').textContent);
  })());
  // The dealer reveal, driven end to end on a crafted settled round.
  // v1.7: the dealer drew one card at a time during his turn, so every
  // dealer card is already showing at the settle — the reveal is just the
  // beat to look at the finished table before the results come out.
  check('reveal: every dealer card is already showing at the settle', (() => {
    ev(`view={phase:'settled',turnPlayerId:null,roundNumber:1,round:{specialTotal:0,battle:false,battleWinnerId:null},version:1,deckCount:40,results:{me:{outcome:'win',payout:500,breakdown:{win:200,blacknyack:300,fiveCard:0,special:0,battle:0},total:21,handClass:'blacknyack',specials:0,bet:100,battleWinner:false}},log:['Black Nyack — round 1.','Test bets 100.','Dealer stands on 19.','Test wins 500 (21)'],dealer:{cardCount:3,total:19,low:19,cards:[{rank:'9',suit:'♣',special:false,faceUp:true},{rank:'K',suit:'♥',special:false,faceUp:true},{rank:'5',suit:'♦',special:false,faceUp:true}]},players:[{id:'me',name:'Test',isBot:false,seat:0,stack:1500,bet:0,doubled:false,stood:true,busted:false,spectating:false,left:false,cardCount:2,total:21,low:11,cards:[{rank:'A',suit:'♠',special:false,faceUp:true},{rank:'K',suit:'♥',special:false,faceUp:true}]},{id:'bot',name:'Ada',isBot:true,seat:1,stack:900,bet:0,doubled:false,stood:true,busted:false,spectating:false,left:false,cardCount:2,total:19,low:19,cards:[{rank:'9',suit:'♠',special:false,faceUp:true},{rank:'K',suit:'♦',special:false,faceUp:true}]}]}`);
    ev(`render()`);
    const cards = window.document.querySelectorAll('#dealerHand .mini-card');
    const backs = window.document.querySelectorAll('#dealerHand .mini-card.back');
    return cards.length === 3 && backs.length === 0
      && !$('logBox').textContent.includes('wins 500')
      && !/WIN!/.test($('mySeat').textContent)
      && $('winModal').classList.contains('hidden')
      && /results in a moment/.test($('statusBox').textContent);
  })());
  check('reveal: the dealer label shows his total at the settle', (() => {
    return /DEALER — 19/.test($('dealerHand').textContent);
  })());
  check('reveal: the look pause shows the results but not the pop-up', (() => {
    ev(`showSettleResults()`);
    return /DEALER — 19/.test($('dealerHand').textContent) && /WIN!/.test($('mySeat').textContent)
      && /Round 1 over/.test($('statusBox').textContent) && $('winModal').classList.contains('hidden');
  })());
  check('reveal: the pop-up opens after the win text', (() => {
    ev(`openSettleDialog()`);
    return !$('winModal').classList.contains('hidden') && /Acquired/.test($('winBody').textContent);
  })());
  check('reveal: the log shows the settle lines once the results are out', $('logBox').textContent.includes('wins 500'));
  ev(`clearRevealTimers()`);
  // The die is a real six-sided die: two blank sides worth 0, two 1s, two 2s.
  check('die is a real six-sided die', JSON.stringify(ev(`SPECIAL_DIE_FACES`)) === '[0,0,1,1,2,2]');
  check('die has two blank sides worth 0', ev(`SPECIAL_DIE_FACES.filter(f=>f===0).length`) === 2);

  /* ---- scenario 9: v1.5 — dealer cards up close and small, no legs
     counter line, pain lines back (sometimes) ---- */
  check('dealer cards are mini, not big', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    const minis = window.document.querySelectorAll('#dealerHand .mini-card').length;
    const bigs = window.document.querySelectorAll('#dealerHand .card-big').length;
    return minis === ev(`view.dealer.cardCount`) && bigs === 0;
  })());
  check('dealer hand sits just under the ring on the round table', (() => {
    ev(`document.body.classList.add('round-table')`);
    return window.getComputedStyle($('dealerHand')).top === '166px';
  })());
  check('dealer hand clears the bottom seat even on the shortest table', (() => {
    const handTop = parseInt(window.getComputedStyle($('dealerHand')).top, 10);
    // the hand is ~70px tall (label + mini cards); the bottom seat's center
    // sits at 82% of the table, whose shortest height is 430px
    return handTop + 70 < 0.82 * 430;
  })());
  check('pain lines never mention a game event', !/bust|21|losing|you lost|you won|winner|battle|double down|special|blackjack/i.test(ev(`PAIN_LINES.join(' ')`)));
  check('pain lines are a small pool', ev(`PAIN_LINES.length`) === 3);
  check('CRACK float sits bottom-left of the dealer zone, clear of the bubble', (() => {
    const css = window.document.querySelector('style').textContent;
    return /\.bat-hit-float\{position:absolute;left:0;top:70%/.test(css);
  })());

  /* ---- scenario 10: v1.5.1 — the die never misses a roll, even in a long
     session; a 0-roll still shows the die and says what specials are worth ---- */
  check('die still shows a roll after the log window slides (round-8 bug)', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    // three earlier rolls, all shown — then let the die settle
    ev(`rollSpecialDie(fullState, 'Test'); rollSpecialDie(fullState, 'Test'); rollSpecialDie(fullState, 'Test'); refreshView(); render();`);
    ev(`clearTimeout(dieTimer); clearInterval(dieTick); dieRolling=false; dieQueue.length=0; hideDie();`);
    // a long session: push filler log lines until the oldest line in the
    // 40-line window is a roll line — the exact spot where the old
    // count-based detection swallowed the next roll
    ev(`let guard=0; while(guard++<60 && !/ rolled [0-2] /.test(fullState.round.log.slice(-40)[0])) fullState.round.log.push('filler line '+guard);`);
    // one more special is dealt — its roll must still show the die
    ev(`rollSpecialDie(fullState, 'Test'); refreshView(); render();`);
    return !$('specialDieWrap').classList.contains('hidden') && ev(`seenRollsThisRound`) === ev(`fullState.round.rolls.length`);
  })());
  check('a 0-roll still shows the die and says the specials are worth 0', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false}], 7, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`refreshView(); render();`);
    ev(`fullState.round.specialTotal=0; fullState.round.rolls=[0]; seenRollsThisRound=0; refreshView(); render();`);
    return !$('specialDieWrap').classList.contains('hidden') && ev(`dieRolling`) === true && $('specialSub').textContent === 'Every ★ is worth 0';
  })());

  /* ---- scenario 11: v1.6 — hit / double-down cards come folded, the
     dealer play opens them automatically for everyone ---- */
  check('a bot hit card comes folded (a back in its seat)', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    // rig the bot to 12 so it hits, and rig the deck top so the hit is a 2 (no bust)
    ev(`fullState.players[1].hand=[{id:'b1',rank:'7',suit:'♠',special:false,faceUp:true},{id:'b2',rank:'5',suit:'♥',special:false,faceUp:false}]; fullState.deck.push({id:'2♣-rig',rank:'2',suit:'♣'}); refreshView(); render();`);
    $('btnStay').click(); // my turn ends; the bot acts next
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    const seat = window.document.querySelector('.seat[data-pid="p1"]');
    return seat && seat.querySelectorAll('.mini-card').length === 3 && seat.querySelectorAll('.mini-card.back').length === 2;
  })());
  check('the dealer play opens every folded card automatically', (() => {
    // rig the bot to 21 with two folded cards, then let it stay — the dealer
    // starts playing next, and his first act opens every folded card
    ev(`fullState.players[1].hand=[{id:'b1',rank:'5',suit:'♠',special:false,faceUp:true},{id:'b2',rank:'6',suit:'♥',special:false,faceUp:false},{id:'b3',rank:'K',suit:'♦',special:false,faceUp:false}]; refreshView(); render();`);
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    const seat = window.document.querySelector('.seat[data-pid="p1"]');
    const opened = ev(`view.phase`) === 'dealerTurn' && seat && seat.querySelectorAll('.mini-card').length === 3 && seat.querySelectorAll('.mini-card.back').length === 0;
    ev(`dealerPlay(fullState); refreshView(); render();`); // finish Nyau's turn, then settle
    const ok = opened && ev(`view.phase`) === 'settled';
    ev(`clearRevealTimers()`);
    return ok;
  })());

  /* ---- scenario 12: v1.7 — no Hit at 5 cards, Ace hands read "4 or 14",
     Nyau draws one card at a time ---- */
  check('Hit is never allowed at 5 cards (button disabled, engine refuses)', (() => {
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    // rig my hand to 5 cards (2+3+2+2+2 = 11, no bust) on my turn
    ev(`fullState.players[0].hand=[{id:'m1',rank:'2',suit:'♠',special:false,faceUp:true},{id:'m2',rank:'3',suit:'♥',special:false,faceUp:true},{id:'m3',rank:'2',suit:'♦',special:false,faceUp:false},{id:'m4',rank:'2',suit:'♣',special:false,faceUp:false},{id:'m5',rank:'2',suit:'♠',special:false,faceUp:false}]; refreshView(); render();`);
    const btnDisabled = $('btnHit').disabled === true;
    const engineRefuses = ev(`applyAction(fullState, 'p0', {type:'hit'})`).ok === false;
    return btnDisabled && engineRefuses;
  })());
  check('an Ace hand reads "4 or 14" (A+3)', (() => {
    ev(`fullState.players[0].hand=[{id:'m1',rank:'A',suit:'♠',special:false,faceUp:true},{id:'m2',rank:'3',suit:'♥',special:false,faceUp:true}]; refreshView(); render();`);
    return /Your hand • 4 or 14/.test($('mySeat').textContent);
  })());
  check('A+K reads "11 or 21", and a hand with no Ace reads one number', (() => {
    ev(`fullState.players[0].hand=[{id:'m1',rank:'A',suit:'♠',special:false,faceUp:true},{id:'m2',rank:'K',suit:'♥',special:false,faceUp:true}]; refreshView(); render();`);
    const ace = /Your hand • 11 or 21/.test($('mySeat').textContent);
    ev(`fullState.players[0].hand=[{id:'m1',rank:'9',suit:'♠',special:false,faceUp:true},{id:'m2',rank:'7',suit:'♥',special:false,faceUp:true}]; refreshView(); render();`);
    const plain = /Your hand • 16/.test($('mySeat').textContent) && !/or/.test($('mySeat').textContent);
    return ace && plain;
  })());
  check('Nyau draws one card at a time, each shown before the next', (() => {
    // a fresh round: I stay, the bot stays, and the dealer turn starts —
    // he has only his first 2 cards until the driver steps him
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
    [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    ev(`fullState.players[0].hand=[{id:'m1',rank:'9',suit:'♠',special:false,faceUp:true},{id:'m2',rank:'8',suit:'♥',special:false,faceUp:false}]; fullState.players[1].hand=[{id:'b1',rank:'9',suit:'♣',special:false,faceUp:true},{id:'b2',rank:'8',suit:'♦',special:false,faceUp:false}]; fullState.dealer.hand=[{id:'d1',rank:'2',suit:'♠',special:false,faceUp:true},{id:'d2',rank:'3',suit:'♥',special:false,faceUp:false}]; fullState.deck.push({id:'4♣-rig',rank:'4',suit:'♣'}); refreshView(); render();`);
    $('btnStay').click();
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
    const atDealerTurn = ev(`view.phase`) === 'dealerTurn' && ev(`view.dealer.cardCount`) === 2;
    const before = window.document.querySelectorAll('#dealerHand .mini-card').length;
    ev(`dealerDrawOne(fullState); refreshView(); render();`);
    const oneMore = window.document.querySelectorAll('#dealerHand .mini-card').length === before + 1;
    const labelShowsTotal = /DEALER — 9/.test($('dealerHand').textContent); // 2+3+4 = 9
    // step him until he stands, then settle
    ev(`let g=0; while(g++<10){ const r=dealerDrawOne(fullState); if(!r.drew) break; } refreshView(); render();`);
    ev(`dealerFinish(fullState); refreshView(); render();`);
    const settled = ev(`view.phase`) === 'settled';
    ev(`clearRevealTimers()`);
    return atDealerTurn && before === 2 && oneMore && labelShowsTotal && settled;
  })());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('UI TEST CRASHED:', e); process.exit(1); });
