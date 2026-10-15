# Art pipeline: ChatGPT to game

1. Get a batch of PNGs from ChatGPT using the art prompt (one character, one pose per image, magenta `#FF00FF` background, filenames like `haakon_idle.png`).
2. Put the batch in any folder, then run from the project folder:

   ```powershell
   python tools/process_art.py "C:\path\to\batch"
   ```

   (Needs Pillow once: `pip install pillow`.)

3. The script removes the magenta, trims, snaps sprites back to their pixel grid, cleans the palette, saves them into `assets/sprites/` or `assets/bg/`, and registers them in `assets/manifest.json`.
4. Reload the game. Anything listed in the manifest replaces the placeholder with the same name. Anything missing keeps its placeholder, so you can add art one file at a time.
5. Commit and push. GitHub Pages updates the live link in a minute or two.

## Names the game looks for

- Heroes: `haakon_`, `mike_`, `josh_`, `griffin_` + `idle | attack | hurt | downed | cast | victory | portrait`
- Dani: `dani_idle | dani_heal | dani_attack | dani_scold | dani_happy | dani_portrait`
- Enemies: `goblin_grunt`, `goblin_archer`, `goblin_brute`, `dire_wolf`, `skeleton_auditor`, `slime_blob`, `grey_alien`, `alien_probe_drone`, `mimic_chest`, `boss_dungeon_landlord` + `_idle | _attack | _hurt`
- NPCs: `npc_goblin_merchant_idle`, `npc_goblin_dealer_idle`, `npc_devil_dealer_idle`
- Backgrounds: `bg_dungeon_crypt`, `bg_dungeon_cave`, `bg_goblin_market`, `bg_goblin_casino`, `bg_alien_crash_site`, `bg_landlord_office`, `bg_treasure_vault`, `bg_rest_campfire`, `bg_devil_shrine`, `bg_boulder_pass`, `bg_title`, `map_background`
- Icons: `icon_gold_coin`, `icon_potion_health`, `icon_protein_shaker`, `icon_rusty_crown`, `icon_mystery_meat`, `icon_energy_drink`, `node_fight`, `node_elite`, `node_boss`, `node_shop`, `node_casino`, `node_event`, `node_unknown`, `node_treasure`, `node_rest`, `node_alien`, `node_start`
- Props: `prop_campfire`, `prop_chest`, `prop_boulder`, `prop_slots`

Only `_idle` is required for any character. Every other pose falls back to idle, and the code adds the motion (lunges, hops, flashes, knockback, falling over).

## Notes

- Heroes and Dani must face **right**; enemies and NPCs face **left** in the source art. (The game flips enemies, so if ChatGPT draws an enemy facing right, just flip it before processing.)
- Backgrounds need an empty floor in the bottom third. The party stands on the left, enemies on the right.
- On-screen sizes are fixed in `src/config.js` (`SPRITE_HEIGHT`), so source resolution doesn't matter.
