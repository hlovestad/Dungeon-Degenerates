# Online play

Every friend plays on their own phone. One phone **hosts**: it runs the rules
(`src/systems/`), the bots and the timers, and broadcasts every move. The
others are **clients**: they draw what the host sends and send back their taps.
Bots fill any seat nobody has claimed, and take over a seat if its phone drops
for 10 seconds (or a player sits on their turn for 40 seconds).

## Playing

1. Title screen -> **ONLINE** -> **HOST A ROOM**. You get a 4-digit room code.
2. Tap **SHARE LINK** and text it to the group (or they tap ONLINE -> JOIN A ROOM and type the code).
3. Everyone taps the friend they are. Empty friends are bots.
4. Host taps **START STACK ATTACK**. After a game the host picks PLAY AGAIN or LOBBY.

## How it connects

- `src/net/transport.js` - Supabase Realtime broadcast (`dd-room-<code>`), using the
  publishable key in `src/net/config.js`. No database tables, no server of our own.
- `src/net/session.js` - the room: seats, heartbeats, who's allowed to act for which seat.
- `src/scenes/Lobby.js` - host / join / pick your friend.
- `src/minigames/Stack.js` - `role` is `local`, `host` or `client`.

## Testing solo

Add `?net=local` to the URL. Rooms then run over the browser's BroadcastChannel, so
several **tabs in the same browser** act as several phones (no internet needed).
Host in one tab, then open the share link (it keeps `&net=local`) in other tabs.

## What's online

- **ARCADE NIGHT** (lobby button): the whole arcade. The host runs the hub (spins, quips, events,
  chaos, crowns); whoever's turn it is picks from their own phone; bots pick for themselves.
- Every minigame: rules in `src/systems/partygames.js`, screen in `src/minigames/PartyGame.js`.
  Reflex games (quick draw, mash, clock, whack) are timed on each phone, so lag doesn't matter.
- **TRIVIA NIGHT** (lobby button): 6 trivia rounds; each round's picker chooses the theme and 10/15/20/30 questions.
  Questions live in `src/data/trivia/<theme>.js` (about 1,000 across 18 themes); add a theme in `src/data/trivia/index.js`.
  No question repeats within a night.
- **STACK ATTACK** (lobby button, or one game of a night).
- Test: `node tools/party_sim.mjs` (every party game, bots only).
- Up to 6 players: the four friends (bots if empty) + two goblin guest seats (Grub, Snot) for extra people.
