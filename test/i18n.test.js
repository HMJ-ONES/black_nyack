// Black Nyack i18n test (jsdom, no browser needed).
// The 7-language switcher: dictionary completeness, switching changes
// visible text, the choice persists, log lines + taunts translate, the
// SEGA disclaimer stays English verbatim in every language.
// Run: node test/i18n.test.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

const SEGA_LINE = 'Nyau and all SEGA characters are © SEGA. All credit to SEGA — the creator of this site holds no rights to Nyau or any SEGA property, and this game is not affiliated with or endorsed by SEGA.';

function boot(presetLang) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      if (presetLang) window.localStorage.setItem('lang', presetLang);
    },
  });
  return dom;
}

(async () => {
  const dom = boot();
  const { window } = dom;
  const $ = id => window.document.getElementById(id);
  const ev = src => window.eval(src);
  await new Promise(r => { if (window.document.readyState === 'complete') r(); else window.addEventListener('load', r); });

  /* ---- the switcher: in the header, 7 languages, always visible ---- */
  check('language switcher exists', !!$('langSelect'));
  check('switcher lives in the header (visible on every screen)', !!window.document.querySelector('header #langSelect'));
  check('switcher offers all 7 languages', [...$('langSelect').options].map(o => o.value).join(',') === 'en,pt,es,zh,ja,fr,ko');
  check('switcher shows EN | PT | ES | ZH | JA | FR | KO', [...$('langSelect').options].map(o => o.textContent.trim()).join('|') === 'EN|PT|ES|ZH|JA|FR|KO');
  check('switcher does not replace the music/rules buttons', !!$('musicToggle') && !!$('btnRules'));

  /* ---- dictionary: 7 languages, every key present, none empty ---- */
  const langs = ev(`Object.keys(I18N)`);
  check('dictionary has exactly the 7 languages', JSON.stringify(langs) === '["en","pt","es","zh","ja","fr","ko"]');
  const enKeys = ev(`Object.keys(I18N.en)`);
  check('English has a large key set', enKeys.length >= 200, 'got ' + enKeys.length);
  for (const l of langs) {
    const keys = ev(`Object.keys(I18N['${l}'])`);
    check('every key present in ' + l, enKeys.every(k => keys.includes(k)) && keys.length === enKeys.length,
      'missing: ' + enKeys.filter(k => !keys.includes(k)).join(','));
    check('no empty strings in ' + l, ev(`Object.values(I18N['${l}']).every(v=>typeof v==='string'&&v.trim().length>0)`));
  }
  check('placeholders never invent new names outside English',
    ev(`Object.keys(I18N).every(l=>Object.keys(I18N.en).every(k=>{const a=(I18N.en[k].match(/\\{[a-z]+\\}/g)||[]);const b=(I18N[l][k].match(/\\{[a-z]+\\}/g)||[]);return b.every(p=>a.includes(p));}))`));
  check('placeholders never drop a required name (except the plural {s})',
    ev(`Object.keys(I18N).every(l=>Object.keys(I18N.en).every(k=>{const a=[...new Set(I18N.en[k].match(/\\{[a-z]+\\}/g)||[])];const b=[...new Set(I18N[l][k].match(/\\{[a-z]+\\}/g)||[])];return a.every(p=>p==='{s}'||b.includes(p));}))`));

  /* ---- taunts: 18 general + 3 pain in every non-English language ---- */
  for (const l of ['pt', 'es', 'zh', 'ja', 'fr', 'ko']) {
    check('18 general taunts in ' + l, ev(`TAUNTS_I18N['${l}'].general.length`) === 18);
    check('3 pain lines in ' + l, ev(`TAUNTS_I18N['${l}'].pain.length`) === 3);
    check('no empty taunt in ' + l, ev(`TAUNTS_I18N['${l}'].general.concat(TAUNTS_I18N['${l}'].pain).every(s=>s.trim().length>0)`));
  }
  check('English taunts stay canonical (tests pin them)', ev(`TAUNTS.general.length`) === 18 && ev(`PAIN_LINES.length`) === 3);

  /* ---- default language is English ---- */
  check('default html lang is en', window.document.documentElement.lang === 'en');
  check('menu headline is English by default', $('menuScreen').textContent.includes('Beat the dealer. Take his coins.'));
  check('footer shows v1.7.3', window.document.body.textContent.includes('Black Nyack v1.7.3'));
  check('footer carries the SEGA credit in English', window.document.body.textContent.includes(SEGA_LINE));

  /* ---- switching changes visible text + persists ---- */
  ev(`setLang('pt')`);
  check('switching to pt changes html lang', window.document.documentElement.lang === 'pt');
  check('changing the select itself switches the language', (() => {
    ev(`setLang('en')`);
    $('langSelect').value = 'pt';
    $('langSelect').dispatchEvent(new window.Event('change', { bubbles: true }));
    return window.document.documentElement.lang === 'pt' && window.localStorage.getItem('lang') === 'pt';
  })());
  check('switching to pt changes the menu headline', $('menuScreen').textContent.includes('Vença o dealer. Fique com as fichas dele.'));
  check('switching to pt changes the create button', $('btnCreate').textContent.includes('Criar lobby'));
  check('switching to pt changes the rules button', $('btnRules').textContent.includes('Regras'));
  check('choice persists in localStorage under key lang', window.localStorage.getItem('lang') === 'pt');
  check('switcher value follows the choice', $('langSelect').value === 'pt');
  check('SEGA disclaimer stays English verbatim in pt', window.document.body.textContent.includes(SEGA_LINE));
  check('footer version stays v1.7.3 in pt', window.document.body.textContent.includes('Black Nyack v1.7.3'));

  ev(`setLang('ja')`);
  check('switching to ja changes the menu headline', $('menuScreen').textContent.includes('ディーラーを倒して、チップを奪え。'));
  check('switching to ja changes the hit button', $('btnHit').textContent.includes('ヒット'));
  check('switching to ja changes the log label', $('logLabel').textContent.includes('ゲームログ'));

  ev(`setLang('ko')`);
  check('switching to ko changes the menu headline', $('menuScreen').textContent.includes('딜러를 이기고 코인을 가져가세요.'));
  ev(`setLang('zh')`);
  check('switching to zh changes the menu headline', $('menuScreen').textContent.includes('击败庄家，赢走他的筹码。'));
  ev(`setLang('es')`);
  check('switching to es changes the menu headline', $('menuScreen').textContent.includes('Gánale al crupier.'));
  ev(`setLang('fr')`);
  check('switching to fr changes the menu headline', $('menuScreen').textContent.includes('Battez le croupier.'));

  /* ---- language resolution + fallback ---- */
  check("resolveLang maps pt-BR to pt", ev(`resolveLang('pt-BR')`) === 'pt');
  check("resolveLang maps zh-TW to zh", ev(`resolveLang('zh-TW')`) === 'zh');
  check("resolveLang maps fr-FR to fr", ev(`resolveLang('fr-FR')`) === 'fr');
  check("resolveLang maps unknown languages to en", ev(`resolveLang('de')`) === 'en');
  check("resolveLang maps empty to en", ev(`resolveLang('')`) === 'en');
  check('unknown language code falls back to English text', (() => { ev(`setLang('xx')`); return window.document.documentElement.lang === 'en' && $('menuScreen').textContent.includes('Beat the dealer. Take his coins.'); })());
  check('missing key falls back to the key itself', ev(`t('no.such.key')`) === 'no.such.key');
  check('missing key in one language falls back to English', (() => { ev(`setLang('pt')`); return ev(`t('status.waiting')`) === 'Aguardando…'; })());

  /* ---- the stored choice wins on a fresh load ---- */
  const dom2 = boot('ko');
  const w2 = dom2.window;
  await new Promise(r => { if (w2.document.readyState === 'complete') r(); else w2.addEventListener('load', r); });
  check('a stored ko choice loads Korean on a fresh page', w2.document.documentElement.lang === 'ko'
    && w2.document.getElementById('menuScreen').textContent.includes('딜러를 이기고 코인을 가져가세요.'));

  /* ---- log lines translate at display time (pt samples) ---- */
  ev(`setLang('pt')`);
  const logCases = [
    ['Black Nyack — round 1. Place your bet (5 / 10 / 20 / 40 / 50) or spectate.', 'rodada 1'],
    ['BATTLE BONYAS is live this round! The single best winning hand takes a huge bonus.', 'BATTLE BONYAS nesta rodada'],
    ['Ada rolled 2 — special cards now worth 3.', 'rolou 2'],
    ['Round 2 — cards dealt to Ada, Boris. Dealer shows one card.', 'cartas distribuídas'],
    ['Dead round — nobody bet. Place your bets and try again.', 'Rodada vazia'],
    ['Ada left before the deal — bet refunded.', 'aposta devolvida'],
    ['Ada left — their cards return to the deck.', 'voltam ao baralho'],
    ['Ada left the game.', 'saiu do jogo'],
    ['No players left — the round ends.', 'Nenhum jogador'],
    ['Dealer reveals — every player busted, so the dealer does not draw.', 'todos os jogadores estouraram'],
    ['Dealer plays — watch him draw, one card at a time.', 'uma carta de cada vez'],
    ['Dealer stands on 17.', 'para no 17'],
    ['Dealer stands on 16 with 5 cards.', 'com 5 cartas'],
    ['Dealer busts with 24.', 'estoura com 24'],
    ['Ada wins 500 (21)', 'vence 500'],
    ['Ada wins 500 (21) — BATTLE BONYAS WINNER!', 'VENCEDOR DO BATTLE BONYAS'],
    ['Ada pushes — stake back 50 (20)', 'aposta de volta 50'],
    ['Ada loses (19)', 'perde (19)'],
    ['Round 3 — place your bets (5 / 10 / 20 / 40 / 50) or spectate.', 'Rodada 3'],
    ['Ada rebought 1000 free chips.', 'recebeu 1000 fichas grátis'],
    ['Ada bets 20.', 'aposta 20'],
    ['Ada spectates this round.', 'assiste esta rodada'],
    ['Ada hits and busts.', 'pede carta e estoura'],
    ['Ada hits and holds 5 cards.', 'fica com 5 cartas'],
    ['Ada hits.', 'pede carta'],
    ['Ada stays.', 'para.'],
    ['Ada doubles down and busts.', 'dobra a aposta e estoura'],
    ['Ada doubles down.', 'dobra a aposta'],
    ['Ada joined to spectate — seats are fixed once a game starts.', 'entrou para assistir'],
  ];
  for (const [en, ptBit] of logCases) {
    check('log line translates to pt: ' + en.slice(0, 42) + '…',
      ev(`translateLog(${JSON.stringify(en)})`).includes(ptBit),
      'got: ' + ev(`translateLog(${JSON.stringify(en)})`));
  }
  check('English log lines stay untouched in en', (() => { ev(`setLang('en')`); return ev(`translateLog('Ada bets 20.')`) === 'Ada bets 20.'; })());
  check('unknown log lines pass through untouched', (() => { ev(`setLang('pt')`); return ev(`translateLog('Something nobody wrote.')`) === 'Something nobody wrote.'; })());

  /* ---- engine error strings translate through toast ---- */
  check('engine error translates in pt', ev(`translateError('not your turn')`) === 'não é a sua vez');
  check('parameterised engine error translates in pt', ev(`translateError('not enough chips for a 50 bet')`) === 'fichas insuficientes para uma aposta de 50');
  check('unknown error passes through untouched', ev(`translateError('weird new error')`) === 'weird new error');

  /* ---- in-game dynamic text follows the language ---- */
  ev(`setLang('es')`);
  window.eval(`startLocalGame([{name:'Test',isBot:false},{name:'Bot',isBot:true}], 42, {})`);
  check('in-game status is Spanish after switching', $('statusBox').textContent.includes('haz tu apuesta'));
  check('in-game bet prompt is Spanish', $('betPrompt').textContent.includes('Haz tu apuesta'));
  check('in-game hit button is Spanish', $('btnHit').textContent.includes('Pedir carta'));
  check('in-game stay button is Spanish', $('btnStay').textContent.includes('Plantarse'));
  check('in-game special box label is Spanish', window.document.querySelector('.special-label').textContent.includes('ESPECIAL'));
  // Bet 20: the log line renders translated in the log box.
  [...window.document.querySelectorAll('#betChips .chip')].find(b => b.textContent.trim() === '20').click();
  check('game log renders translated after a bet', $('logBox').textContent.includes('apuesta 20'),
    'log: ' + $('logBox').textContent.slice(0, 200));

  /* ---- rules modal translates, keeps proper names + numbers ---- */
  ev(`setLang('zh')`);
  $('btnRules').click();
  check('rules modal opens in zh', !$('rulesModal').classList.contains('hidden'));
  check('rules body is Chinese', $('rulesBody').textContent.includes('目标'));
  check('rules keep Battle Bonyas untranslated', $('rulesBody').textContent.includes('Battle Bonyas'));
  check('rules keep the 1200 cap', $('rulesBody').textContent.includes('1200'));
  $('rulesClose').click();

  /* ---- Nyau taunts translate (fr), English stays canonical ---- */
  ev(`setLang('fr')`); ev(`tauntChance=1`);
  ev(`dealerSay('idle')`);
  check('a French taunt shows in the bubble', ev(`TAUNTS_I18N.fr.general.includes($('tauntBubble').textContent)`),
    'got: ' + $('tauntBubble').textContent);
  ev(`dealerSay('legs')`);
  check('a French pain line shows after breaking legs', ev(`TAUNTS_I18N.fr.pain.includes($('tauntBubble').textContent)`),
    'got: ' + $('tauntBubble').textContent);
  ev(`setLang('en')`); ev(`dealerSay('idle')`);
  check('English taunts come back after switching back', ev(`TAUNTS.general.includes($('tauntBubble').textContent)`));

  /* ---- Battle Bonyas rate: rules text must match the engine (8%) ---- */
  check('engine Battle Bonyas rate is 8%', ev(`BATTLE_ODDS`) === 0.08);
  for (const l of langs) {
    const li4 = ev(`I18N['${l}'].howLi4`);
    check('howLi4 in ' + l + ' says 8%', /8\s?%/.test(li4), 'got: ' + li4);
    check('howLi4 in ' + l + ' never says 12%', !/12\s?%/.test(li4));
  }

  /* ---- footer version + SEGA line in every language ---- */
  for (const l of langs) {
    check('footer in ' + l + ' carries v1.7.3', ev(`I18N['${l}'].footer`).includes('v1.7.3'));
    check('footer in ' + l + ' keeps the SEGA disclaimer verbatim', ev(`I18N['${l}'].footer`).includes(SEGA_LINE));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
