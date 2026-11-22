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
  check('special box has a die, hidden until a ★ is dealt', !!$('specialDie') && $('specialDieWrap').classList.contains('hidden'));
  check('break-legs button sits next to Nyau inside the table', $('dealerZone').contains($('breakLegsBtn')) && $('breakLegsBtn').classList.contains('break-mini'));
  check('break-legs button exists', !!$('breakLegsBtn'));
  check('legs counter exists', !!$('legsCount'));
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
  // If the bot hit and is still to move, drive it until the round settles.
  for (let i = 0; i < 5 && ev(`view.phase`) === 'playerTurns'; i++) {
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
  }
  check('round settles', ev(`view.phase`) === 'settled');
  check('results exist for me', !!ev(`view.results`) && !!ev(`view.results[myId]`));
  check('WIN dialog shows at settle', !$('winModal').classList.contains('hidden'));
  check('WIN dialog shows the acquired total', /Acquired/.test($('winBody').textContent));
  check('dealer total is revealed at settle', /DEALER/.test($('dealerHand').textContent));
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
  check('bot plays alone while I spectate', ev(`view.phase`) === 'settled' || ev(`view.phase`) === 'playerTurns');
  for (let i = 0; i < 5 && ev(`view.phase`) === 'playerTurns'; i++) {
    ev(`applyAction(fullState, 'p1', botChooseAction(fullState, 'p1'))`);
    ev(`refreshView(); render();`);
  }
  check('spectated round settles', ev(`view.phase`) === 'settled');
  check('no WIN dialog for a spectator', $('winModal').classList.contains('hidden'));
  $('btnNextRound').click();
  check('spectator is offered entry again next round', ev(`view.phase`) === 'betting' && !$('betBox').classList.contains('hidden'));

  /* ---- scenario 3: break his legs — anytime, infinitely; bat hides after
     2s, legs grow back after a few minutes (both driven by named functions
     the test can call directly instead of waiting on real timers) ---- */
  check('legs start unbroken', $('legsCount').textContent === '0');
  ev(`tauntChance=1`); // the bubble only speaks sometimes — force it for this check
  $('breakLegsBtn').click();
  $('breakLegsBtn').click();
  $('breakLegsBtn').click();
  check('three bat swings counted', $('legsCount').textContent === '3');
  check('dealer legs show broken', $('dealerLegs').classList.contains('broken'));
  check('bat swung', $('bat').classList.contains('swing'));
  check('dealer face shows pain while legs are broken', $('dealerSvg').classList.contains('pain'));
  check('dealer complains in the taunt bubble', /legs/i.test($('tauntBubble').textContent));
  ev(`hideBat()`);
  check('bat disappears after the hit (hideBat)', !$('bat').classList.contains('swing'));
  check('legs counter is a lifetime total even after healing', (() => {
    ev(`healLegs()`);
    return $('legsCount').textContent === '3' && !$('dealerLegs').classList.contains('broken');
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
  check('legs line names Nyau', /Nyau/.test(window.document.querySelector('.legs-line').textContent));
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
    return ev(`TAUNTS.idle.includes($('tauntBubble').textContent)`);
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
    const h = ev(`bannerFor({id:'me',busted:false,cards:[{},{},{}],total:20,doubled:false})`);
    return /WIN!/.test(h) && /\+500/.test(h);
  })());
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
  check('a fresh "rolled N" log line makes the die roll', (() => {
    // start a real game first: scenario 6 replaced view with a stub that has no log
    window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 99, {forceBattle:false})`);
    ev(`view.log.push('Ada rolled 1 — special cards now worth 1.')`);
    ev(`hideDie()`); ev(`render()`);
    return !$('specialDieWrap').classList.contains('hidden') && $('specialDie').classList.contains('rolling');
  })());
  check('die hides again on a new round', (() => {
    ev(`lastDieRound=0`); ev(`render()`);
    return $('specialDieWrap').classList.contains('hidden');
  })());
  check('die tumbles about 0.75s before landing', ev(`DIE_ROLL_MS`) === 750);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('UI TEST CRASHED:', e); process.exit(1); });
