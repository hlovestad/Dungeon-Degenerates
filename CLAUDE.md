# Dungeon Degenerates - notes for Claude

Read `docs/HANDOFF_FROM_CHATGPT.md` for the full vision. Locked-in rules:

- It's **Haakon** (with an H), Mike, Josh, Griffin.
- **Not a page/card game.** Characters are always visible sprites in a scene. Menus overlay the scene, never replace it.
- Control model: **(b)** party moves together across a node map; every node is a full spatial scene.
- **Arcade mode and minigames use portraits only, never full-body sprites** (`portraitActor` in `ui/stage.js`). Full bodies are for the dungeon and combat.
- Quips, AFK gags, random events and visual chaos (psychosis, poop, Archie) run in both the dungeon and the arcade (`systems/arcade.js`, `ui/interlude.js`, `ui/chaos.js`). Chaos is visual only. Keep flashing under 3 per second.
- Pixel art everywhere. Landscape orientation, except the STACK ATTACK card table, which plays upright and fills any phone (`ui/orientation.js`: 288 wide x the screen's shape). Big tap targets (min ~40px game units).
- **Mike:** big nose, curly dark hair, beard, NOT green skin, NO crocodile hat. Goblin affinity changes NPC behaviour and prices.
- **Josh:** third eye, Anunnaki/cosmic look. Alien probe gag is cartoon slapstick, never graphic or sexual.
- **Griffin:** long hair, mustache. **Dani** belongs only to Griffin, black hair, horns/wings, **fully clothed** (high-neck tunic, long coat, gloves, boots). Her interruptions must stay occasional.
- Any race can take any class; signature race+class pairs get a bonus.
- No real money anywhere.
- **Every friend plays on their own phone, remotely. No phone passing, no shared screen, no hotseat.** Haakon can't play-test in person, so every feature must be testable solo: bots fill empty seats, and multiple browser tabs can act as multiple players.

## Architecture

- No build step. Phaser 3.90 is vendored in `lib/`. ES modules in `src/`. Deployed by GitHub Pages from `main`.
- `src/systems/` holds all rules and state with **no Phaser imports**. Combat functions mutate a battle object and return event lists that `scenes/Battle.js` animates. Keep it that way: the future multiplayer host will run these and broadcast events.
- All randomness goes through `rng` in `systems/state.js` (seeded).
- Texture keys follow the art prompt filenames (`haakon_idle`, `bg_dungeon_crypt`, `icon_gold_coin`). Real art in `assets/manifest.json` overrides placeholders. Missing poses fall back to `_idle`.
- Sprites are drawn facing right; enemies are flipped in code.

## Checks before pushing

- `node tools/sim.mjs` (balance + catches rule crashes)
- `node tools/stack_sim.mjs` (card game: 3000 bot games, card count + no stalls)
- Load the game in a phone-sized landscape viewport and play a fight.
