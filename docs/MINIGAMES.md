# Minigames

Design rules: easy to understand in 5 seconds, mostly luck, 10-20 seconds long, and someone should get screwed.

## Built (v0.3.1)

### Showdowns (after every room except the casino and boss)
Winner also gets a random dirty card. SKIP cards bench a player; DOUBLE DOWN doubles their winnings.

| Game | How it plays | Payout |
| --- | --- | --- |
| Quick Draw | Each friend owns a corner. Wait for BONK!, smack your corner first. Early tap = out. Fake "BONG?" baits early taps. | 1st 25g, 2nd 10g |
| Mash Off | Mash your corner for 5 seconds. | 25g / 12g / 5g |
| High Card | Everyone antes 10g, house adds 10g. Tap to flip. Highest card takes the pot. Griffin may redraw a 2-4. | Whole pot |
| Pick a Chest | Pass the phone, poorest picks first. 5 chests: +50, +25, +10, HEIST (steal 20 from the richest), BOMB (-20). | Varies |
| Hot Potato | Pass the phone. HOLD for +10g or BANK and get out. Boom chance starts 10% and rises 10% per hold. Blow up = lose it all + 10g. | Whatever you bank |
| Split or Steal | Two random friends, a 60g pot (they each chip in 10). Secret picks behind a pass-the-phone curtain. Both split = share, one steals = takes all, both steal = goblins keep it. The other two bet on whether anyone steals. | Pot / 15g side bets |
| Goblin Derby | Everyone bets 15g on a racer: Speedy Gonk x2, Sir Slime x3, Drunk Gary x4, Grandpa Grib x7. Racers trash-talk and Grandpa naps. | Bet x odds |
| Stop the Clock | Corners. Tap at exactly 5.00 seconds; the clock vanishes after 1.5s. | 1st 25g, 2nd 10g |

### Map rooms
| Game | How it plays |
| --- | --- |
| Goblin Casino | Pick who's gambling, pick a bet (10/25/50/ALL IN). Coin Flip 50% x2, Long Shot 10% x8, Moonshot 4% x22. Crown Counter sells crowns (60g, +15 each time anyone buys). Griffin doubles odds of 10% or less; Mike gets one free spin. |
| The Idiot's Trial | 3 trivia questions, a different friend answers each. Right +20g, wrong = zap (-5 HP, -5g). Josh's third eye removes 2 wrong answers (others pay Josh 10g to use it). |
| Wheel of Misfortune | Chance Time. The room picker spins: Swap Gold, Gift 30g, Bankrupt (lose half), Jackpot (+50g), Swap Crowns, Card Thief, Tax Day (pay everyone 10g), Robin Hood (richest pays poorest 25g). Name reels pick who. |
| Whack-a-Goblin | The room picker plays for 20s. Goblin +3g, gold goblin +10g, bomb goblin -5g, Mike's crowned cousins -5g. Payout capped at 45g. |

### In battle
- Power meter on every ability: stop in gold for PERFECT (x1.5).
- Dodge prompt on the Landlord's rent attack: tap DODGE when it flashes for half damage. Too early = full hit.

### Dirty cards (played from the map)
TAX +15, PICKPOCKET (5-30), SWAP (all gold), SKIP (sit out next showdown), DOUBLE DOWN, REVERSE (held, bounces the next card back).

## Ideas (not built)

Cut: Most Likely To (vote-based roast game). Not the vibe.

Tags: [1P] works great on one phone, [PASS] pass-and-play with secrets, [MP] really wants separate phones.

### Screw-your-friends
- **Bounty Board** [1P]: bet gold that a friend gets knocked out in the next fight. If they go down, you collect double.

### Card and dice games
- **Goblin Eights** [MP/PASS]: Uno-style shedding game with our own cards: +2/+4 TAX cards, SKIP, REVERSE, color swap. First out takes the pot. Also the headline game for the arcade.
- **Twenty-Gob** [1P]: blackjack against the goblin dealer.
- **Bluff Bones** [PASS]: Liar's Dice. Bid on everyone's hidden dice, call LIAR.
- **Higher or Lower** [1P]: chain of cards, keep guessing to grow the pot, one wrong and you lose it.

### Gambling
- **Mimic Roulette** [PASS]: a ring of chests, one bites. Open or pass. Pot grows each safe open.
- **Devil's Briefcases** [1P]: Deal or No Deal. The devil calls with offers.
- **Scratch-offs** sold in the market: instant win or lose.
- **Pachinko of Doom** [1P]: drop a coin, pray.

### Quick reflex (still mostly luck)
- **Balloon Pump** [PASS]: pump for gold, pop = lose it. Hot Potato's cousin.
- **Tug of War** [1P]: 2 vs 2 mash.
- **Simon Says** [1P]: repeat the growing sequence. Last one standing wins.
- **Price Is Right** [PASS]: guess what the goblin market charges for absurd items. Closest without going over.
