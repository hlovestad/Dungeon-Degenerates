# Backlog

Notes from play-testing and ideas for later.

## From the first battle (2026-10-15)

- **Move descriptions.** Every action button (Attack, abilities, Defend/Flex, Potion) needs a short description of what it does, visible before you tap it.
- **Make every battle more ridiculous.** Each fight should have a funny hook: absurd enemy lines, weird intros, silly moves and outcomes. Fights shouldn't feel like plain stat exchanges.
- **Josh vs dogs.** In any fight against dogs/wolves, Josh only takes part in half the fight. The rest of the time he watches from a bush and comments ("I'm not gonna get in the middle of that."). Inside joke, keep it in.

Status: all three done in v0.2.

## Later: standalone minigame arcade (after the crawl is built)

- A menu on the title screen to play minigames on their own, outside a run.
- Minigames are already built to support this: `Trivia` and `Whack` scenes take `{ mode: 'arcade', returnTo }`.
- Wanted: lots of party games. Ideas: an Uno-style shedding card game (needs our own name and card design, not Uno branding), more trivia packs, dice duels, reaction races, drawing/guessing.
- Best with the online lobby so everyone plays from their own phone.

## Online lobby (top priority as of 2026-10-15)

- Decision: no phone passing at all. Each friend is on their own phone, not in the same room. Online multiplayer is required, not optional.
- Haakon tests alone: needs bots for empty seats and multi-tab play.

- Supabase project created: `Dungeon-Degenerates` (https://fbphgkkcqlubmbqgvyva.supabase.co).
- Needed from the dashboard when we build it: the **publishable / anon key** only (Project Settings > API Keys). Never commit the secret / service_role key.
