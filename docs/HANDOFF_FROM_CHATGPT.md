# DUNGEON DEGENERATES — Project Handoff for Claude

**Project:** Funny, replayable, mobile-browser multiplayer hybrid party roguelike  
**Status:** Concept/character direction established; rough single-device HTML prototype v0.2.1 exists; **major gameplay/presentation pivot required**  
**Date:** October 15, 2026  
**Owner's immediate instruction:** This is a handoff, **do not assume any new game implementation has been approved**. Discuss architecture and propose a sensible next development step before undertaking a major rewrite.

## 1. The vision, most importantly

Build a game four friends can play **on separate phones through a shared browser link**, ideally in the same online lobby. Characters must **physically exist in a visible game world**: move around, explore and fight enemies, with a view evoking *For The King* in terms of visible party members and enemies in a scene, **but with intentionally pixelated 2D art**. The user's latest screenshot is a *For The King* battle scene showing a party of heroes facing wolves in a spatial environment with combat UI. **It is a reference for the embodied/spatial gameplay presentation, NOT a request to copy its 3D low-poly art style or exact interface.**

**CRITICAL CHANGE FROM EARLIER VERSIONS:** User explicitly does **NOT** want a sequence of static web page/card screens where gameplay is just clicking through room descriptions. Earlier HTML prototypes are useful as mechanical sketches only, **not a suitable gameplay template**. Build a real visible dungeon/exploration scene with actual character sprites, enemies, environment, movement/placement, and animated actions, while keeping party-game mini-game overlays as secondary elements. Combat can be turn-based/tactical while movement/exploration can be controlled or discrete; discuss the best lightweight browser-friendly approach. Prioritize fun and accessibility over RPG complexity.

Design inspiration: hybrid of approachable roguelike, chaotic multiplayer party game, gambling, trivia, skill mini-games, light strategic combat, and nonsensical personal jokes. Intended for friends who ordinarily **do not play or like dungeon crawlers**. It must remain genuinely rewarding *without* relying on inside jokes alone. Keep runs short (~15–25 minutes), controls phone-friendly, onboarding easy, and replayability high. The broad references previously discussed include *The Binding of Isaac*, *Mario Party*, *Balatro*, and the latest *For The King* battle screenshot.

**Title:** *Dungeon Degenerates*. Tone: absurd, rude, adult-leaning comedy and grotesque fantasy, but still charming/playful and gameplay-first. Tagline used: “Different races. Same classes. Maximum degeneracy.” No real-money gambling is requested: all bets and rewards are fictional in-game mechanics.

## 2. Firmly agreed playable character/race concepts

Exactly **four initial playable character identities** (potentially more later), each based on a friend's uploaded photo. The player's named friend is their **fantasy race**, not a rigid class: **any race can select any class**, but each race has a tailored signature class that gains an extra synergistic advantage. Racial abilities should be noticeable in the whole run, including noncombat encounters. Racial strengths should come with genuinely meaningful/funny weaknesses. The owner explicitly said the core racial identities below are **LOCKED IN**:

| Character/race | Locked-in identity | Signature class (current proposal) | Mechanical expression |
|---|---|---|---|
| **Haakon / Haakonian** | **Physical dominance and overconfidence**; by far the physically strongest | **Juggernaut** | Dominant melee damage/defense and strong first hit; pride/ego leads to dangerous commitments, penalties for retreat, potentially bad overconfident choices |
| **Mike / Mikanite** | **Goblin faction reputation**; goblin-like **without green skin**, recognizable curly dark hair, beard, muscular stature, **oversized nose** | **Goblin King** | Goblin NPCs, merchants, and enemies recognize him as one of their own; better prices/special deals/diplomacy with goblins; non-goblin factions dislike him, mark up prices and/or deal more damage |
| **Josh / Joshian** | **Clairvoyance and alien harassment**; alternative-spiritual **Anunnaki-inspired** aesthetic and visible **third eye** | **Cosmic Oracle** | Can glimpse upcoming rooms/traps, learn useful hints/weaknesses; in **every alien battle**, a silly cartoon alien mouth-probe/scanner gag animation occurs, with an inconvenient brief combat debuff |
| **Griffin / Griffinite** | **Long-shot gambling and Dani's interference** | **Hellbound Gambler** | Improves odds specifically for very low-probability risky bets, not all normal chances; has **Dani as exclusive demon/succubus companion** who sometimes heals/attacks/helps odds, but periodically interrupts him and takes away a turn with a comic **“Pussywhipped”** debuff |

### Racial numerical examples from design exploration (not final balance)
- Haakon: +30% physical damage; +15% incoming physical damage mitigation; opening blow +25% damage; ego/retreat downside.
- Mike: goblin shops ~30% off (existing prototype market uses 40%); outsider shops ~20% markup; non-goblin damage taken +12%; optional goblin allies.
- Josh: 25% chance to expose a trap, answer, or weakness; preview upcoming encounter; unavoidable alien inspection gag during alien battles, temporarily reducing accuracy or costing a turn. Make it **cartoony slapstick, not graphic/sexual**.
- Griffin: very unlikely outcomes get meaningfully boosted, e.g. 5% to 10%, without generally boosting 50/50 bets; Dani's beneficial and detrimental reactions; possible “Double or Nothing” decisions.

**Remember:** These numbers are experiments; tune so a single race does not dominate. Keep racial identity separate from chosen class. Character names must be spelled **Haakon**, Josh, Griffin, Mike. Do not revert to “Aakon.”

### Suggested universal classes
1. Juggernaut (Haakon racial synergy)
2. Goblin King (Mike racial synergy)
3. Cosmic Oracle (Josh racial synergy)
4. Hellbound Gambler (Griffin racial synergy)
5. Cleric (healing/support, no favored race initially)
6. Rogue (critical hits, stealing, speed, no favored race initially)

Classes should impact social, trivia, casino, treasure, exploration and combat, not merely raw DPS. Races choose any class, with a signature pairing bonus.

## 3. Dani (important finalized art and game constraint)

Dani is a **specific real person's photo-based fantasy depiction** associated **exclusively with Griffin**. The user supplied a photo and asked to change her hair to **black**. Use facial likeness as a guide, with demonic horns/wings, a distinctive silhouette, and true pixel-art styling.

**Firm latest requirement:** Dani should wear **substantially more clothing** and look **NOT promiscuous**. For example, high-neck burgundy/black tunic, fitted full-coverage armored coat or leather battle armor, leggings, gloves, boots and cloak. Gothic/dark-fantasy, companion mage/demon, not lingerie or cleavage-focused art. A prior generated character sheet still showed revealing outfits despite the request; **do not perpetuate that error**. Treat the fully clothed direction as authoritative.

Dani appears alongside Griffin **regardless of his class**; she is not an independent selectable race or universally obtainable party companion. She can trail/hover beside him as an additional animated figure and assist with battle/encounters (heal, attack, alter luck) or interrupt his action (Pussywhipped). Her powers should be occasional rather than constantly removing player agency. Possible sprites/states: idle/hover, follow, heal, attack, scold/interrupt. She can alter the wider party's situation, but should still be bound to Griffin alone.

## 4. Identity and art references — actual available files

The original photos supplied in this conversation are available in this handoff session under these names (Claude will need these uploaded separately or attached in the transfer environment):

- `IMG_0959.jpeg` — **Haakon**: short dark wavy hair, muscular/broad-shouldered, clean cut, dark suit in source photo (suit isn't compulsory game attire). Fantasy visual: overtly physically imposing, confident/brute-like.
- `IMG_0957.jpeg` — **Mike**: medium curly/wavy dark hair, short beard, athletic/muscular; picture has **a novelty green crocodile hat, which the user explicitly does NOT want in-game**. Fantasy visual: huge pronounced nose, slightly pointed ears, goblin-esque physiognomy, **normal/non-green skin**.
- `IMG_0955.jpeg` — **Josh**: short blond hair, clean-shaven, smiling; fantasy visual: third eye on forehead, ancient-cosmic/Anunnaki-themed jewelry, robes or armor and symbolism.
- `IMG_0958.jpeg` — **Griffin**: long wavy brown hair, characteristic mustache/beard, relaxed expression; fantasy visual: mustached, long-haired risky gambler / demon-bound adventurer. Dani accompanies him.
- `IMG_0960.jpeg` — **Dani**: long hair in source photo; **draw with black hair**, recognizable but stylized face; fantasy demon companion with horns/wings and **fully covered practical fantasy clothes**.
- `a_detailed_pixel_art_game_character_roster_selecti.png` — early concept lineup for all four, pixelated but not all final requirements met.
- `a_detailed_pixel_art_game_concept_character_sheet.png` — later generated lineup with Dani-specific companion section and more pixelated style; **some Dani representations are still too revealing**, so use only as broad palette/layout inspiration and revise her outfit.
- `image(20261015-200326).png` — user-supplied screenshot showing **For The King** spatial battle: three heroes visibly present facing three wolves, with HUD, terrain and attacks. **Crucial reference for changing the gameplay viewpoint.**
- `image(20261015-200147).png` — screenshot of current prototype, which shows the unwanted *card/web page* presentation and an in-preview visualization error.

**Art approach:** Cohesive pixel art (not semi-realistic paintings, not 3D low-poly), strong recognizable hairstyles/facial silhouettes, clear sprites at mobile size. Need real sprite sheets and animation frames for gameplay, in addition to portraits for selection. Think authored pixelated dungeon scenery, floors, obstacles, battles, merchants and enemy creatures. Avoid text embedded into sprite textures.

## 5. Gameplay direction and proposed run loop

1. Friends open a URL on their phones, join/create room via code; each selects a character/race and class. Ideally four human-controlled avatars; accommodate short-handed testing through bots/hotseat if necessary.
2. Party **visibly enters the dungeon in a game scene**, with movement/exploration and party/enemy world representations. Characters appear as sprites throughout gameplay, not just photos/UI cards.
3. Encounter spatial enemies, an NPC, traps, treasure, shops, or a party-game room. Some encounters naturally trigger an overlay/minigame, but return to scene afterward.
4. Fight in a visually staged battle, with sprites, attacks, readable HP/status indicators and effects; explore turn-based/tactical combat for accessible multiplayer. Avoid heavy action-control demands on mobile. Show Dani next to Griffin, and aliens near Josh during his inspection gag.
5. Make cooperative or secret/competitive decisions, acquire upgrades, gold, consumables and increasingly absurd synergies.
6. Fight a boss, win or wipe, review scores/highlights, replay with different class combinations and randomly selected encounters.

**Potential encounter library:**
- Goblin Casino: wager in-game gold or HP for outsized treasure; Griffin's long-shot boosts; Mike treated as goblin insider.
- The Idiot's Trial: short accessible trivia with class/race information bonuses; Josh can see clues.
- Treasure Betrayal: players make secret chest choices, possible conflict or curse.
- Devil's Offer: each player secretly chooses 100 safe gold vs attempt 500 gold if sole risk-taker (else penalty), with simultaneous reveal.
- Timed skill minigames: dodge, timing attacks, reaction tests, dice/slots, quick trivia races.
- Goblin town/shop with special Mike interactions.
- Alien patrol with comedic **non-graphic telescoping mouth scanner** animation on Josh and temporary disadvantage.
- Boss possibility: **The Dungeon Landlord**, an absurd fantasy landlord demanding rent/security deposits. This exists in the older prototype, but it is not an immutable requirement.

**Key engagement principle:** Cooperative goal, but frequent temptations for a player to greedily sabotage, gamble, negotiate selfishly or save everyone. Betrayals should be entertaining and fair, not total griefing, and should produce memorable anecdotes. Minigames should last about 10–20 seconds where possible.

## 6. What has actually been built so far

Existing legacy code files in the ChatGPT artifact workspace:

- `dungeon_degenerates.html` — first static-screen single-device HTML5 prototype.
- `dungeon_degenerates_v02.html` — revised character mechanics and portrait imagery.
- `dungeon_degenerates_v021.html` — latest revised single-file prototype (embedded WebP portraits), made to try to avoid preview loading issues.
- `dungeon_degenerates/index.html` — folder variant of earlier prototype.
- `build_dd.py` — local script used for prototype construction.

**Do not assume these are production code.** They are rough vanilla JS/HTML/CSS vertical slices, originally designed as card/room screens. They include a menu, team/class setup, four characters in one party managed by one player, 7 linear rooms, turn-command combat, casino, trivia, goblin shop, alien sequence, devil deal, and Dungeon Landlord. In `v021` specifically the room progression includes Skeleton Audit, Goblin Casino, Idiot's Trial, Goblin Market, Alien Inspection, Devil's Offer, Dungeon Landlord. Example classes are Juggernaut, Goblin King, Cosmic Oracle, Hellbound Gambler, Cleric and Rogue. Some portrait art is encoded into the standalone HTML file as WebP data URIs.

**Caveats:**
- **There is no live multiplayer, hosted public link, actual navigable dungeon map, characters in a physical scene, sprite movement, proper 2D animation or persistent account backend.**
- The first run was reported in the ChatGPT HTML preview as **“An error occurred inside the visualization.”** Screenshot shows UI partially rendered; root cause not conclusively identified. The v0.2.1 revision was proposed but no user test outcome for it is yet known.
- Some mechanics are placeholders or dev-shortcuts and may be imbalanced (e.g. 'Dani' represented by conditional JS random effects, alien mouth inspection by HTML/emoji sequence, static room progression); treat as proof of concept only.
- User's **newest direction supersedes the current page-based layout**. Do not simply add new CSS to the current cards and call it done. A scene-based architecture/presentation is desired.

## 7. Development requirements / decisions to resolve with user

- **Target:** modern mobile browsers (iPhone Safari and Android Chrome); ideally desktop browser too. One URL to play, no app install required. Touch friendly and performance-conscious.
- **Multiplayer:** four individually controlled clients joining a lobby with a room code, real-time synchronized or turn-based as appropriate. Hosting and a realtime authoritative backend will be needed for actual shared multiplayer. Do not claim the current local HTML file supports this.
- **Engine suggestion to evaluate:** Phaser 3 (2D scenes, tilemaps, animation, touch controls) + a multiplayer service such as Colyseus, Supabase Realtime or similar. Pick based on effort, reliability and low hosting cost. A simple custom canvas implementation is an alternative but will require more bespoke logic. No user commitment to an engine yet.
- **Scene camera/combat view:** user wants an *actual visible world*. Suggest a low-cost 2D pixel-art top-down / 3/4-view party exploration scene and in-scene side/isometric-ish turn-based combat. Show a sample layout or small playable walking-and-battle slice before producing a giant full game.
- **Content:** procedurally selected room/encounter progression, loot, synergies, enemy types, goblin/alien factions, and short games. Keep prototype scoped and demonstrable.
- **Audio:** whimsical crunchy retro sound effects, optional mute button, discreet soundtrack. Avoid obnoxious repetitive gag animations.
- **UX:** responsive mobile layout with world scene taking center stage, small contextual controls, big tap targets, readable HUD/status, portrait panels that don't crowd the scene, and minimal blocking UI during fights.
- **Assets:** source character photos need to be passed into Claude or its image/art workflow for likeness. Generated concept sheet isn't a precise animation-ready sprite sheet; create real consistent character art/sprite spritesheets. Don't use third-party protected game assets.

## 8. Suggested first true scene-based vertical slice

Build **one short playable dungeon scene with 4 embodied sprites and 1 enemy formation**, rather than expanding 7 static web-page rooms. Include: character/class select, party entering a visible room, basic movement or stepping positions, one turn-based fight with sprite animations, one Mike goblin NPC/shop, one Griffin/Dani event, one Josh alien encounter, and one Haakon strength/ego choice. Add a very basic gambling or trivia overlay. Once actual physical-world interaction feels good on a phone, expand to procedural rooms and multiplayer.

**Ask the user which of these is their preferred control model if needed:** (a) each player walks their character in an explorable dungeon and party enters tactical turn-based combat when engaging enemies; (b) party progresses together through an overworld of selectable nodes, but each node is a full spatial animated encounter scene. Both have visible embodied characters; option (b) is simpler to ship. What is **not** acceptable is returning to a simple web page list of encounter buttons with portraits at the top.

## 9. Established constraints and explicit corrections

- It's **Haakon** with H.
- **No crocodile hat** on Mike. **Prominent nose; NOT green.** Goblin affinity is not a purely cosmetic joke; it materially changes NPC relations.
- **Josh must have a third eye**; Anunnaki/cosmic motif; mouth-probe animation is silly, non-explicit slapstick, occurring for each alien battle.
- **Dani only belongs to Griffin.** **Black hair. Fully clothed, not promiscuous.** Use her real-photo reference. Interruptions shouldn't make the character miserable to play.
- **Pixelated art style throughout** (UI, sprites, environments).
- **Visible characters actively in scene**, inspired by *For The King* screenshot; **NOT a page-based game**.
- Classes remain universal with racial synergies; race attributes + disadvantages remain prominent.
- No public link hosting or fully functional multiplayer has been completed.
- User does **not** want any further changes made yet in the ChatGPT session beyond this handoff file.

## 10. A good first message from Claude

Acknowledge the main pivot: **the user wants a real sprite-based dungeon world where their friends visibly move and fight, not a sequence of HTML cards**. Confirm that Dani is Griffin-only and fully covered, and show a concise architecture/visual plan plus an achievable first scene-based playable milestone. Ask at most one truly important question before writing a large new implementation, then build iteratively and let the user play early.

---

*This handoff was assembled from the entire ChatGPT planning conversation and from inspection of the latest `dungeon_degenerates_v021.html` source. Treat proposed stats and class mechanics as adjustable unless explicitly marked locked in. The latest gameplay-format change and Dani clothing requirement take precedence over earlier concepts.*
