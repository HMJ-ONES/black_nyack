# 🃏 Black Nyack — free browser blackjack (21)

**Black Nyack** is a free browser blackjack game for **1–5 players** against the dealer,
in the same format as Wellington and Five-Card Poker: a single `index.html`, no sign-up,
no cost, multiplayer peer-to-peer via PeerJS, hosted free on Cloudflare Pages.

> **v1.7.3:** 7-language switcher (EN / PT / ES / ZH / JA / FR / KO) at the
> top of the page — every menu, lobby, table, rules, win-dialog, log and
> Nyau taunt line translated; choice persists in localStorage.
> All tests green: `npm test` (see [Tests](#tests)).

- **Repo:** https://github.com/HMJ-ONES/black_nyack
- **Live:** https://black-nyack.pages.dev *(connected + verified Nov 22 — home page and both songs serve 200)*
- **Players:** 1–5 at a round table, dealer in the middle (mobile sideways = same round table as PC)
- **Currency:** casino coins — free play coins only, no real money

## v1.7.3 — 7 languages (Nov 25)

- **Language switcher at the top of the page** — EN | PT | ES | ZH | JA |
  FR | KO, visible on the menu, the lobby and in-game, without scrolling
  and clear of the table, the bet chips and the break-legs button. The
  choice is saved in localStorage (`lang`); on load the saved choice wins,
  else the browser language is mapped to one of the 7, else English.
  English is the fallback for any missing key.
- **Everything user-visible is translated** — static text via `data-i18n`
  attributes, dynamic strings (status lines, bet/action prompts, win
  dialog, toasts, lobby and public-room messages, engine error strings)
  through a `t(key)` function, and the game log lines at display time
  (the engine itself still logs in English — its log strings are pinned
  by tests). Nyau's 18 general taunts and 3 pain lines are translated
  too; the English tables stay canonical. Player names, room codes and
  proper names (Black Nyack, Battle Bonyas, Nyau) are never translated,
  and the SEGA footer disclaimer stays in English verbatim in every
  language. No gameplay, rules, balance or payout changes.

## v1.7.2 — Specials are rarer: 3 in the deck (Nov 25)

- **Special cards cut from 6 to 3** — the deck is now 55 cards (52
  standard + 3 special), so a dealt card is a special about 5.5% of the
  time instead of about 10%. Everything about a special is unchanged
  once it shows up: the die still rolls 0/1/2, the results still stack
  into one shared value, specials are still always face-up.

## v1.7.1 — The dealer never draws a 6th card either (Nov 25)

- **5 cards is the most any hand can hold — the dealer's included.** A
  live screenshot showed Nyau with six cards in Round 2; he kept drawing
  under 17 with no cap. Now he stands at 5 cards even if he is still
  under 17 (the log says "Dealer stands on N with 5 cards"), so no hand
  on the table — his or anyone's — ever holds a 6th card.

## v1.7 — Nyau draws one by one, Ace hands read "4 or 14" (Nov 25)

- **Nyau draws one card at a time** — his turn used to happen instantly
  (all his cards were already in his hand, and the settle just flipped
  them over one by one). Now the dealer turn is stepwise: the hole card
  flips, then he draws a single card, it shows on the table and his
  running total updates, then — about a second later — the next one. You
  watch each card land before he takes the next. The settle no longer
  re-flips his cards; it is just the beat to look at the finished table
  before the results come out.
- **Ace hands show both values** — a hand with an Ace reads "4 or 14"
  (A + 3), "11 or 21" (A + K), and so on, everywhere a total shows: your
  hand, the dealer's running total, and the seats at the settle. A hand
  with no soft total reads one number, as before.
- **Hit is never allowed at 5 cards** — the rule was already enforced in
  the engine and the button, and v1.7 adds a test proving both: at 5
  cards the Hit button is disabled and the engine refuses the action.
  (Also fixed a display quirk found while working on this: when the
  dealer's up-card was a special worth 0, the label read "DEALER — shows
  0" — it now reads "DEALER — shows ★ 0".)

## v1.6 — Folded hit cards, opened at the dealer play (Nov 22)

- **Hit and double-down cards come folded** — when another player hits or
  doubles down, the new card is dealt face-down: you see a red back in
  their seat, not the card. The player who drew it always sees their own
  cards (and their total), so nothing changes for the player themselves.
  Special cards are still always face-up, as before.
- **The dealer play opens them automatically** — the moment the dealer
  starts playing, the software flips every player's cards face-up for
  everyone: the folded hit/double-down cards and the hole cards too. No
  tapping, no waiting for the settle — the whole table is open by the time
  the dealer finishes.

## v1.5.1 — The die never misses a roll; Battle Bonyas rarer (Nov 22)

- **Die bug, fixed** — a special could be dealt and the die would never
  roll: the special stayed "worth 0" and the box said "no value yet".
  Cause: the die watched the game log for "rolled N" lines, but the log only
  keeps its last 40 lines — in a long session (round 8 in the report) an old
  roll line slid out of the window in the same render a new roll arrived,
  and the count re-baseline swallowed the new roll. The die now watches the
  round's own roll list (one entry per special dealt, in order, never
  trimmed), so a roll can never be missed. A 0-roll also counts now: the die
  lands on its blank face and the box says "Every ★ is worth 0" instead of
  "no value yet".
- **Battle Bonyas is a bit rarer** — 12% → **8%** per round, about one
  battle round in twelve instead of one in eight.

## v1.5 — Dealer cards up close, no counter line, pain lines back (Nov 22)

- **Dealer cards up close and small** — the dealer's hand now sits right
  under Nyau's ring (166px from the top of the table, at any table height)
  and uses the small mini cards instead of the big ones, so it can never end
  up underneath the player seats. The "CRACK! +1" float moved to the
  bottom-left of the dealer zone, clear of the speech bubble.
- **No legs counter line** — the "🦵 Legs broken: N — Nyau the dealer" line
  is gone from the table, and the toast after a break no longer shows a
  count or a name. The break still counts internally (the face still shows
  the pain, the legs still regrow after 3 minutes).
- **Pain lines are back — sometimes** — breaking his legs can make him yelp
  again ("OW! MY LEGS! ...I'm still dealing."), gated by the same ~35%
  chance as his other lines. This is the one exception to the general-only
  rule: the break is the player's own direct action on their own screen, so
  a pain line is always in sync with what just happened. His face shows the
  pain every time; the words only sometimes.

## v1.4 — The reveal, general smack, no Hit on 21 (Nov 22)

- **The settle is a reveal, not an instant** — when a round ends, the dealer
  flips his cards one by one (0.8s apart), then everyone gets a second to
  look at the finished hands, then the big win text appears, and only then
  does the pop-up open. Until the results show, the dealer total, the
  banners, the settle lines in the log and the Next round button all stay
  hidden, so nothing spoils the reveal. The 8s auto-advance hold now starts
  when the results are fully shown, not at the settle.
- **Nyau talks general smack only** — his bubble lines never mention a
  specific event (no bust, no 21, no "you're still losing", no legs, no
  battle). The bubble isn't synced to the game state, so an event line would
  show up on the wrong screen at the wrong time. One pool of 18 lines —
  "I'm gonna win", "The coins were always mine" — funny, mildly
  infuriating, true no matter what just happened.
- **No Hit or Double Down on 21** — at 21 the only move is Stay. Enforced in
  the engine (Hit/Double are refused, and bots never do it either) and in the
  UI (both buttons disabled, prompt says "Stay and lock it in").
- **The die is a real six-sided die** — its faces are 0, 0, 1, 1, 2, 2, so
  two blank sides are worth 0. The tumble now flickers through the six real
  faces instead of three values.
- **GAME LOG label** — the log panel has a visible "💬 GAME LOG" heading that
  stays put above the scrolling lines.

## v1.3 — The die really rolls (Nov 22)

- **A die tumbles and lands** — every time a ★ special is dealt, a die appears in
  the SPECIAL box, flickers through faces for ~0.75s, then lands on the roll (0 =
  blank, 1 = one pip, 2 = two pips) and stays showing it as "LAST ROLL" until the
  next roll. A new round starts with a clean die. If two specials land at once,
  the die rolls twice in a row.
- **Log below the chips** — the recent-activity log now sits at the very bottom of
  the game screen, under the bet chips and the Hit/Stay/Double Down buttons, so
  the log growing as lines are added never pushes the chips down the page.
- **v1.3.1:** the secret round is **Battle Bonyas** again — my v1.1 rename to
  Battle Nyau was wrong. Bonyas is a pun on bonus and has nothing to do with the
  dealer; Nyau is just the dealer's name. Every visible "Battle Nyau" is back to
  "Battle Bonyas" (banner, log, rules, payout table, taunts).

## v1.2 — Room to breathe (Nov 22)

- **Text boxes off the felt** — the bet list and special card box sit in a row
  **above** the round table, and the log sits **below** it. Before, the ellipse
  clipped the bet list and the boxes covered the seats and the dealer hand.
- **Small bubble, at his side** — Nyau's speech bubble is smaller now and sits
  to his top right, next to the dealer ring, instead of sprawling across the
  middle and covering the cards.
- **He talks even less** — taunts fire ~35% of the time (was 50%), idle chatter
  at most once a minute (was 25s), and no taunt at game start. The bubble only
  appears when he actually speaks and **goes away 6 seconds later**.
- **Face back to normal after 7 seconds** — a sad or pained face fades back to
  happy 7 seconds after the reaction; a new break or a newly lost round triggers
  it again.
- **Break his legs, moved up** — the button is a small one **inside the table,
  next to Nyau**, so mobile players can tap it and watch the hit at the same time.
- **v1.2.1:** a Battle Bonyas round no longer makes him speak when the round starts —
  the banner already announces it, so the bubble stays hidden until he actually
  has something to say mid-round.

## v1.1 — Nyau (Nov 22)

- **The dealer is Nyau now** (was Bonyas) — the secret round is **Battle Bonyas**.
- **He only talks sometimes** — about half of the moments that used to trigger a
  taunt now stay silent. His face does the talking instead: **sad** when he loses
  a round, **in pain** while his legs are broken.
- **Break his legs, refined** — the bat disappears 2 seconds after the hit, and
  his legs **grow back after 3 minutes** (the break counter is a lifetime total).
- **Winning rains coins** — a shower of 🪙 falls over the table whenever you win,
  more coins the bigger the win (12 + payout/30, up to 48). A **bust** shows the
  red BUST banner; a **double down** shows the golden DOUBLE DOWN text, shining.
  The WIN banner now shows the amount (`WIN! +500`) and stays up longer — the
  local auto-advance to the next round is 8 seconds instead of 3.

## Credits

**Nyau and all SEGA characters are © SEGA. All credit to SEGA.** Black Nyack is
a fan-made game, just for fun — the creator of this site holds no rights to Nyau
or any SEGA property, and the game is not affiliated with or endorsed by SEGA.

## Rules

### Getting in — bets

- Every player starts with **1000 casino coins**. Broke players (0 coins) may **rebuy
  1000 free coins between rounds**.
- At the start of each round, every seated player **independently** picks a bet —
  **5, 10, 20, 40 or 50** coins — or **spectates** that round. The bet leaves your
  stack immediately. You cannot pick a bet bigger than your stack; with fewer than
  5 coins you can only spectate (or rebuy, if you are at 0).
- If **nobody bets**, the round is **dead**: no cards are dealt, the table stays in
  betting, and everyone picks again.
- Spectators are **automatically offered entry again at the next round** — no leaving
  and rejoining. Anyone may **leave the match at any time** (see
  [Leaving](#leaving)).

### The deal

- One **55-card deck** (52 standard cards + **3 special cards**), shuffled fresh
  every round.
- Each entrant gets **2 cards**: the first **face-up**, the second **face-down**
  (the hole card — only its owner sees it). The dealer gets 2 the same way.
- **Special cards are always face-up for everyone**, even as a second card.

### Card values

| Card | Value |
|---|---|
| Numbered 2–10 | Face value |
| J / Q / K | 10 |
| Ace | 1 or 11, whichever is best without busting — a hand with an Ace shows
  both values, e.g. A + 3 reads **"4 or 14"** |
| Special card | The round's shared **special total** (see below) |

### Your turn — hit, stay, double down

On your turn you have three options:

- **Hit** — take one more card. You may hit **up to 3 times** (5 cards total).
  If you reach 5 cards your turn ends automatically, and Hit is never offered
  again — the button is disabled and the engine refuses it. Hit over 21 and you **bust**
  and lose your bet, even if the dealer busts too. A hit card comes **folded**:
  only its owner sees it — everyone else sees a red back until the dealer
  plays, when the software opens every player's cards automatically.
- **Stay** — keep the hand you have.
- **Double down** — only with exactly **2 cards**. You put in an extra amount equal
  to your original bet (so the total at risk doubles), receive **exactly one more
  card** (folded, like a hit card), and your turn ends.

Turns pass clockwise around the table. At 21 the only move is Stay — Hit and
Double Down are refused, in the engine and in the buttons.

### The 5-card rule

Getting **5 cards without busting** is one of the strongest hands in the game:

- **5 cards, total under 21** beats **even a dealer 21**.
- **5 cards totalling exactly 21** is the strongest hand there is — it only loses
  to nothing, and ties (pushes) only against another 5-card 21.

### The dealer

- The dealer reveals the hole card, then **draws one card at a time while
  under 17** — each card shows on the table (and his running total updates)
  before the next one arrives — and **stands on 17 or more, including soft
  17** (Ace + 6), **or at 5 cards** — 5 is the most any hand can hold, his
  included, so he never draws a 6th card even if he is still under 17.
- If **every entrant busted**, the dealer **does not draw** — the hole card is
  just revealed and the round settles.

### The special die

There are **3 special cards** in the deck. Whenever a special card is dealt to
**anyone** — player or dealer, on the deal, on a hit, or on a double down — a
**6-sided die** is rolled. Its faces are **0, 0, 1, 1, 2, 2**, and the result is
**added to the round's shared special total**. **Every special card on the table
is worth that shared total.**

Worked example from the table: *I have a special card and I roll 1. The dealer
gets a special card and he rolls 2. This means my special card is worth 3 — and
his special card is also worth 3 this round.*

The special total resets to 0 at the start of each round, and special cards are
worth 0 until the first die roll lands.

### Payouts

`B` = your total bet at risk (your original bet, doubled if you doubled down).
Payouts are credited to your stack at the end of the round.

| Outcome | Payout |
|---|---|
| Lose (bust, or dealer beats you) | **0** — your bet is lost |
| Push (exact tie with the dealer) | **B** — your stake back, no bonuses |
| Win | **2 × B** |
| Win with a total of exactly 21 | **+ 3 × B** Blacknyack bonus |
| Win with 5 cards | **+ 5 × B** 5-card bonus |
| Win with special cards in your hand | **+ 2 × B per special card** |
| Battle Bonyas winner | **+ 5 × B** battle bonus |

The **total payout for one player in one round is capped at 1200 coins**.

Worked examples (both verified by regression tests in `test/payout.test.js`):

- **500 coins:** bet 50, 5-card 21, no battle, no specials.
  2×50 (win) + 3×50 (Blacknyack) + 5×50 (5-card) = **500**.
- **1200 coins:** bet 50, double down (B = 100), 3-card 21 with 1 special card,
  Battle Bonyas winner.
  2×100 (win) + 3×100 (Blacknyack) + 2×100 (special) + 5×100 (battle) = **1200**.
- Same hand **without** the battle bonus: 200 + 300 + 200 = **700**.
- Doubled 3-card 21 with **two** specials as battle winner would be
  200 + 300 + 400 + 500 = 1400 uncapped — the cap holds it at **1200**.

### Battle Bonyas (secret random event)

- At the start of **each round** (when betting opens) there is an **8% chance**
  the round is a **Battle Bonyas** round. It lasts **one round only** and can
  trigger again on later rounds.
- The **Battle winner** is the **single best winning hand** among the players who
  beat the dealer that round, ranked by **hand class, then total, then number of
  special cards, then earliest seat**. (Hand classes: 5-card 21 > 5 cards >
  21 > normal.)
- The winner gets **+5 × B** on top of their normal payout. Every other player
  who beat the dealer gets their **normal payout only**.
- If **nobody beats the dealer**, there is **no battle winner** and no battle
  bonus is paid.

### Leaving

- **During betting:** your bet (if any) is **refunded**.
- **Mid-round:** your cards **return to the deck** (reshuffled) and your bet
  **stays lost** in the pot. The turn advances if it was yours; if no entrants
  remain, the round settles immediately.
- If the last player leaves, the game ends.

### Music

- `music.mp3` — the main loop. Plays in a loop, starting every time a match starts.
- `battle.mp3` — plays **only** during a Battle Bonyas round; when the round ends
  the music goes back to the main loop.
- Switching is automatic (the UI watches the round's battle flag); a 🔊 button
  mutes/unmutes, and a "🎵 Tap for music" chip appears if the browser blocks
  autoplay until the first tap. Browsers only allow audio after a user gesture,
  so the music starts on the click that starts the match.

### The dealer (pass 2 — done)

Nyau is the dealer, standing in a glowing alcove at the top of the round table
(drawn as inline SVG). He taunts the table — but only *sometimes* (about half
the things that happen get a word out of him; the rest of the time the bubble
stays quiet). His face always reacts, though: **sad** when he loses a round,
**in pain** (X eyes, open mouth) while his legs are broken. Players get a
**🦵⚾ Break his legs** button: a baseball bat swings across his legs, he
shakes, his legs splay with bandages, the counter goes up — the bat disappears
2 seconds after the hit, and his legs **grow back after 3 minutes**. Usable at
any time, as many times as you like. **Local cosmetic fun only** — it never
touches game state and is never sent to other players.

## Pass 2 — UI / multiplayer / music / dealer

- **Round table (from the screenshots):** green diamond-pattern felt in a wood
  rim, dealer alcove top-center with "BLACK NYACK" arched over it, SPECIAL CARD
  box top-right showing the shared special total, bet list top-left (name +
  BET), dealer hand in the middle, player seats on the bottom arc, chip stacks,
  system log bottom-right, and the big banners — **BLACK NYACK**, **5 CARD**,
  **DOUBLE DOWN**, **BUST**, **WIN!** — over the hands. The WIN dialog lists
  the payout breakdown (Win / Blacknyack / 5 Card / Special / Battle Bonyas /
  Acquired), like screenshot 4.
- **Layout:** landscape (PC, or phone turned sideways) = the full round table;
  portrait = the same table stacked, with a "turn your phone sideways" hint.
- **Your hole card:** your 2nd card stays face-down (only you can see it —
  tap it to peek); everything else you are dealt is face-up, and special cards
  are always face-up for everyone.
- **Multiplayer:** same $0 PeerJS pattern as Wellington / Five-Card Poker —
  Create lobby (private/public, 2–5 players, 0–4 bots), Join by 4-letter code,
  Browse public rooms (manual tap-to-join only, never automatic), Play vs Bots
  (0–4 bots; 0 = solo vs the dealer). Host-authoritative, per-client filtered
  views (hole cards never leak), heartbeat + fingerprint healing.
- **Disconnects:** a dropped seat is held **10 seconds** (the browser retries
  the same code automatically); back in time and you resume your seat. After
  10 seconds the seat is withdrawn via `leavePlayer` (cards back in the deck,
  bet lost if mid-round) and a later rejoin comes back as a spectator.
- **Known limitation — late joiners spectate only:** the engine has no
  `addPlayer`, so seats are fixed when the game starts. Joining a game already
  in progress puts you in as a spectator for the rest of that match (all cards
  hidden); you play from the next lobby. Joining the *lobby* before the host
  presses Start seats you normally.
- **Music:** see [Music](#music) above.

## How to play

| Button | What it does |
|---|---|
| **Create lobby** | Pick how many bots to add (0–4), then choose **Private** (code-only) or **Public** (listed) and a **max players** (2–5, bots included). You get a 4-letter code + shareable link (`?room=CODE`). Players join; you press Start with 1–5 total. |
| **Join lobby** | Enter a friend's lobby code. Joining a game in progress spectates (see above). |
| **Browse public rooms** | Shows open public lobbies (host, code, players / max, bots, waiting/playing). **Tap one to join** — there is never any automatic matchmaking. |
| **Play vs bots** | Pick 0–4 bots. Fully local, works offline. 0 bots = just you vs the dealer. |

At the table: bet with the **5 / 10 / 20 / 40 / 50** chips (or **👀 Spectate**),
then **🃏 Hit** / **✋ Stay** / **💰 Double down** on your turn. **▶ Next round**
when a round settles (the host's button online; local games auto-advance after
a few seconds). **💰 Rebuy** when you hit 0 coins. **🚪 Leave match** any time.

## Interpretations

The brief left a few gaps; this is exactly what pass 1 decided, so pass 2 and
the owner can challenge any of them:

1. **1–5 players.** The table seats at most 5, but a solo player vs the dealer
   works (the engine allows 1 player; the original screenshots show 2+).
2. **Dealer stands on soft 17.** The brief says the dealer stands on 17; soft
   17 (Ace + 6) counts as 17 and the dealer stands.
3. **5-card 21 vs 5-card 21 is a push.** Same hand class, equal total — the
   general tie rule applies.
4. **Blacknyack bonus (+3×B) applies to ANY winning total of exactly 21**,
   not only to a 2-card natural — the brief's payout wording says "if player's
   total is exactly 21", and the 1200 regression case is a 3-card 21.
5. **Special payout bonus is +2×B per special card**, only on a win. A losing
   or pushing hand gets no special bonus.
6. **Battle bonus is +5×B**, paid only to the single best winner.
7. **The 1200 cap applies to the total payout** (win + all bonuses) per player
   per round. Pushes can never reach the cap (max stake back is 100).
8. **Bets are per-player, independent choices** — each player picks their own
   bet or spectates. Unlike Five-Card Poker, there is no fastest-click setter.
9. **No auto-stand on 21.** A player holding 21 may still hit (and bust) or
   stay. Reaching 5 cards **does** end the turn automatically (no legal hit
   remains).
10. **A dead round does not re-roll Battle Bonyas.** The battle flag belongs to
    the round; a dead round is the same round's betting re-opening.
11. **Hit and double-down cards are face-up to everyone.** Only the initial
    second card is a hole card; everything dealt after that is on the felt,
    like the original table.
12. **Push returns the stake only, with no bonuses** — even a 2-card 21 vs a
    dealer 21 is a push with no Blacknyack bonus.
13. **Rebuy is allowed in the betting phase (before you have decided) and in
    the settled phase**, only at exactly 0 coins, for 1000 free coins.
14. **Battle winner ranking is (hand class, total, number of specials,
    earliest seat)** — full ties go to the earliest seat.
15. **Bot play:** bots bet a random affordable amount (spectating 30% of the
    time), hit while their best total is ≤ 16 (never with 5 cards), double on
    a 2-card 10 or 11 when affordable (always on 11, 50% on 10), otherwise stay.
    Bot coin-flips are derived from the seeded game state, so bot play is
    reproducible from the seed.
16. **Dead-round bot retry (pass 2 bug fix):** a bot's default betting
    coin-flip is seeded from (seed, round, seat), so a bot that spectated once
    would spectate again after every dead round with the identical decision —
    a table where everyone spectates could never start. The engine now counts
    dead rounds (`round.deadCount`) and mixes it into the bot's betting seed,
    so the retry decides differently. Regression-tested in `test/engine.test.js`.
17. **Late joiners spectate only** (see Pass 2): the engine has no `addPlayer`,
    so seats are fixed at game start. A mid-game joiner watches that match.
18. **Disconnects:** 10-second seat hold, then withdrawal via `leavePlayer`.
    There is no 3-quick-quit room ban in this game (that rule belongs to
    Five-Card Poker, not Black Nyack).
19. **Your hole card is the 2nd card you are dealt** (face-down to everyone
    else, tap to peek). Hit and double-down cards are face-up to everyone.

## Engine API (pass 1)

The engine is a pure-JS block inside `index.html` with `module.exports`, so the
Node tests extract and run it (same pattern as Five-Card Poker). Key pieces:

- `newGame(playerNames, seed, opts)` — `opts.forceBattle` (true/false) overrides
  the Battle Bonyas roll; used by tests.
- Constants: `BETS`, `START_STACK`, `MAX_PLAYERS`, `MAX_PAYOUT`, `BATTLE_ODDS`,
  `DEALER_STAND`, `SPECIAL_DIE_FACES` — one place to tune.
- `applyAction(st, playerId, action)` — `placeBet`, `spectate`, `hit`, `stay`,
  `double`, `rebuy`, `leave`, `nextRound`.
- `bestValue(hand, specialTotal)` → `{total, soft, bust}`;
  `handClass(hand, specialTotal)` → `{cls, name, total}` (0 bust, 1 normal,
  2 twentyone, 3 five, 4 five21).
- `dealerPlay(st)`, `settle(st)` — the dealer plays automatically when the last
  player turn ends; settlement records per-player
  `{outcome, payout, breakdown:{win, blacknyack, fiveCard, special, battle}}`
  (the same shape the pass 2 "WIN" dialog will show).
- `viewFor(st, viewerId)` (alias `filteredView`) — per-player view: your own
  full hand, everyone else's hole cards as `{hidden:true}`, the dealer's hole
  hidden until the round settles, specials never hidden. The log never contains
  card ranks.
- `leavePlayer(st, playerId)` (alias `removePlayer`), `botChooseAction(st, pid, rnd)`,
  `legalActions(st, pid)`, `serializeState` / `deserializeState`,
  `stateFingerprint`.
- Phases: `betting` → `playerTurns` → `dealerTurn` → `settled` → `betting`.
  (`dealerTurn` is transient — the dealer plays synchronously when the last
  player turn ends.)
- All randomness (deck shuffle, special die, Battle Bonyas roll) flows through
  the seeded rng carried in `state.rngState`, so a game is reproducible from
  its seed.

## Tests

Zero new dependencies — plain `node:assert`-style `check()` tests, same harness
as Five-Card Poker (read `index.html`, extract the `<script>` block containing
`module.exports`, run it in `vm`).

```bash
npm test
# node test/engine.test.js && node test/payout.test.js && node test/battle.test.js && node test/ui.test.js && node test/fairness.test.js && node test/i18n.test.js
```

Current (v1.7.3, Nov 25): engine **163**, payout **37**, battle **29**, UI **177**, fairness **8**, i18n **132** — **546 total, 0 failed**.

| File | Covers |
|---|---|
| `test/engine.test.js` | Constants, 55-card deck, deal + face-up/hole flags, hand values + classes, betting (invalid/insufficient/double-decide, dead rounds, dead-round bot retry, spectators, rebuy), hit/stay/double rules (3-hit max, double only on 2 cards, forced stand), special-die rolls, dealer (stands on 17 incl. soft 17, hits on 16, busts, no draw when all bust), filtered views (hole cards never leak, special 2nd card visible, log clean), leave/remove, bots, plus a **500-round bot soak** (no throws, no negative stacks, no payout over 1200, every round terminates) |
| `test/payout.test.js` | The payout table (plain win, dealer bust, 21 bonus, 5-card bonus, special bonus, push, lose, bust-vs-bust) and all four regression cases: (a) 50 / 5-card 21 → **500**; (b) 50 doubled / 3-card 21 / 1 special / battle winner → **1200**; (c) same without battle → **700**; (d) doubled 3-card 21 / 2 specials / battle winner → 1400 uncapped, **capped to 1200** |
| `test/battle.test.js` | 8% odds (constant + statistical check over 500 seeded rounds), single winner, ranking (class → total → specials → earliest seat), no winner when the dealer wins all / pushes / everyone busts, re-trigger across rounds, battle lasts exactly one round, battle bonus never leaks to other winners |
| `test/ui.test.js` | jsdom DOM smoke test: every screen/panel/button exists, music elements + track selection (`music.mp3` / `battle.mp3`), layout helpers (round vs stacked, arc seat positions), rules modal, menu flow through the real buttons (bot picker → game → back to menu), a full round through the DOM (bet chip → deal → hole-card peek → Stay → settle → WIN dialog → next round), spectate + auto-offered entry next round (incl. dead-round retry), break-the-legs button ×3 (bat hides, legs regrow, pain face), solo game (0 bots), forced Battle Bonyas round, the v1.1 checks: SEGA footer credit, sometimes-only taunts, red BUST / shining DOUBLE DOWN / WIN! +amount banners, coin rain scaling with the win, sad/pain/happy faces, 8s win hold; the v1.2 checks: bet list / special box above the table, log below it, bubble starts hidden and goes away after 6s, taunts at 35% with idle chatter once a minute, face resets after 7s, break-legs button next to Nyau; and the v1.3 checks: special die faces 0/1/2, tumble + land, a fresh "rolled N" log line makes it roll, die hides on a new round, log below the chips and buttons |
| `test/i18n.test.js` | 7-language switcher (jsdom): switcher in the header with all 7 languages, dictionary completeness (every key in all 7 languages, no empties, placeholder names match English), 18 general taunts + 3 pain lines per language, switching changes visible text (menu, buttons, in-game status, log, rules, taunts), choice persists in localStorage and wins on a fresh load, unknown codes fall back to English, SEGA disclaimer stays English verbatim in every language, footer v1.7.3 |

## Deploy to Cloudflare Pages ($0)

**Option A — dashboard (easiest, 2 minutes)**
1. Push this repo to GitHub (`HMJ-ONES/black_nyack`).
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Pick this repo. Framework preset: **None**. Build command: *(empty)*. Output directory: `/` (the repo root — `index.html` is there).
4. Deploy. You get `https://black-nyack.pages.dev` free.

**Option B — CLI**
```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name black-nyack
```

**Custom domain (optional):** Pages → Custom domains → add yours. Still free.

**Multiplayer (pass 2):** peer-to-peer WebRTC via [PeerJS](https://peerjs.com/)'s
free public broker (`0.peerjs.com`). Lobby codes are PeerJS peer IDs; actions
travel directly between browsers. Nothing about your game is stored anywhere.
Same $0 pattern as Wellington, RNG Chess and Five-Card Poker.

## Files

```
index.html            the whole game (engine + UI + multiplayer), single file
music.mp3             main-loop song
battle.mp3            Battle Bonyas song
test/engine.test.js   engine unit tests + 500-round bot soak (node)
test/payout.test.js   payout table + the four regression cases (node)
test/battle.test.js   Battle Bonyas tests (node)
test/ui.test.js       DOM smoke test: menu flow, full round, spectate, legs, music (jsdom)
test/i18n.test.js      7-language switcher: dictionary, switching, persistence, log + taunt translation (jsdom)
wrangler.toml         Cloudflare Pages config (Pages needs no config; no Worker)
README.md             this file
LICENSE               MIT
```

## License

MIT — do what you want with it.
