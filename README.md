# Dungeon Degenerates

A funny, short (15-25 min) party roguelike for four friends, played in a phone browser.
Pixel-art heroes physically walk the dungeon, fight in staged turn-based battles,
gamble at the Goblin Casino and get probed by aliens.

**Play:** https://hlovestad.github.io/Dungeon-Degenerates/ (hold your phone sideways)

## Status: v0.1 prototype

- Single device: one phone controls all four heroes (hotseat). Online lobby comes later.
- All art is generated **placeholder** pixel art. Real art from ChatGPT drops in by filename.
- Content: node map (8 rows), fights, elites, alien fights, boss (The Dungeon Landlord),
  Goblin Market, Goblin Casino, campfire, treasure/mimics, and events
  (Boulder of Pride, Dani Needs to Talk, The Devil's Offer, Goblin Toll).

## New in v0.2

- Every battle button says what it does.
- Battles are dumber now: joke intros, hero one-liners, enemy last words, and random fight rules (Greased Floor, Hype Man, Haakon's Mom Is Watching, Cursed Cheese, Nap Time).
- Josh hides in a bush during dog fights until half the dogs are down.
- Minigames: a power meter on every ability (hit the gold for a stronger move), a dodge prompt on the Landlord's rent attack, The Idiot's Trial (trivia room) and Whack-a-Goblin (Mike's cousins cost you gold).

## Racial hooks that are already in the game

| Hero | In combat | Outside combat |
| --- | --- | --- |
| **Haakon** | +30% physical damage, takes 15% less, opening blow +25%. Can't Defend, only **Flex** (taunts every enemy). | Boulder of Pride: lifts it alone, refuses to walk away. |
| **Mike** | Goblins sometimes refuse to hit him. Non-goblins hit him 12% harder. | 30% off at the Goblin Market, free casino spin, talks his way past the Goblin Toll. |
| **Josh** | Exposes one enemy weak spot each fight. **Probed** in every alien fight (accuracy tanks). | Third eye reveals the whole map. |
| **Griffin** | Chances of 10% or less are doubled (Long Shot, crits). **Dani** sometimes heals or blasts, sometimes **Pussywhipped** (loses turn). | Casino long shots doubled. Date night event. |

## Run it locally

Any static server works. From the project folder (Windows PowerShell):

```powershell
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from disk won't work (browsers block module scripts on `file://`).

## Adding real art

See [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md). Short version:

```powershell
python tools/process_art.py "C:\path\to\chatgpt_batch"
```

## Project layout

```
index.html            entry point (loads Phaser + src/main.js)
lib/phaser.min.js     Phaser 3.90 (vendored, no build step)
src/config.js         resolution, colours, sprite heights, battle positions
src/data/             races, classes, enemies, items  <- tune numbers here
src/systems/          run state, map generator, combat rules (no Phaser)
src/scenes/           Title, Party, Map, Battle, Shop, Casino, Event, End
src/art/              placeholder sprite/background generators + texture registry
assets/manifest.json  list of real art files (overrides placeholders)
tools/process_art.py  cleans ChatGPT art and registers it
tools/sim.mjs         headless balance sim: node tools/sim.mjs
docs/                 ChatGPT handoff, art pipeline
```

## Roadmap

1. Play-test the single-device slice on phones, tune feel and balance.
2. Swap in real art batch by batch.
3. More encounters (Idiot's Trial trivia, Treasure Betrayal, Devil's Offer secret picks), more enemies, relics.
4. Online lobby: room code, one hero per phone, host phone runs the rules (`src/systems` is already Phaser-free and serializable for this).
