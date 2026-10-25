# Dang: Rainy Cabin

A cozy pixel-art match-3 for phones, set in a cabin where it never stops raining. You play a magical girl or magical boy you design yourself.

## How a day works

1. **Character creator** (first launch): name, girl or boy, then skin, hairstyle, hair colour, eyes, eye colour, mouth, cheeks, top, bottoms, bottoms colour, shoes and an accessory, with a live preview and a randomize button.
2. **Morning:** you wake up in bed and transform. Then it's straight into match levels, up to 3 a day. Losing a level ends the day.
3. **Night:** back in the cabin you can:
   - **Phone** Jeff Bezos to order seeds, lumber, fabric, planter kits and the arcade cabinet.
   - **Upstairs:** plant seeds in the leaky attic. Crops grow overnight.
   - **Decorate:** build furniture from materials and crops.
   - **Wardrobe:** spend star shards on magical outfits with perks, including a legendary Saturn set.
   - **Arcade:** once you've bought the cabinet.
   - **Sleep:** start the next day.

## The attic farm

Turn between the attic's four walls (◀ ▶ or swipe), each with four planter spots. A planter kit from Jeff builds a clay pot in any empty spot; upgrade it with lumber, fabric and coins:

| Level | Planter | Plants per seed packet | Upgrade |
| --- | --- | --- | --- |
| 1 | Clay pot | 1 | planter kit |
| 2 | Wooden box | 2 | 2 lumber, 20 coins |
| 3 | Raised bed | 3 | 4 lumber, 1 fabric, 45 coins |
| 4 | Greenhouse bed | 4, and crops grow a night faster | 6 lumber, 2 fabric, 90 coins |

The **Pantry** sells crops for coins (wheat 3, cotton 5, flowers 8, pumpkin 14) and crafts them into mini-game boosts: Catnip Tea (+1 heart), Pumpkin Snack (+2 balls), Honey Toast (+30 s in Word Search or Storm Sweeper, extra digs in Word Sweeper), Cozy Scarf (flags two lightning clouds in Storm Sweeper) and Rainbow Jam (a second chance). When a charged tile starts a mini-game you're offered the boosts that fit it. Prices and recipes live in `js/data.js`.

## Charged tiles and mini-games

Every mini-game is solo and skill-based: no bot opponents.

Bigger match shapes leave a charged tile on the board. **Tap a charged tile** and the board morphs into its mini-game. If two charged tiles end up side by side, **swap them together**: two of the same kind play a *Supercharged* version with a double-size blast, two different kinds play a **mashup**. Win and the tiles blast; lose and they fizzle. Charged tiles don't move on their own; they only shift when a swap makes a match or merges two of them.

| Shape | Tile / game | Blast |
| --- | --- | --- |
| 4 in a row | Storm Sweeper (Minesweeper under rain clouds) | lightning down its row and column |
| 5 in a row | Star Pegs (Peggle-style) | every tile of the most common colour |
| L, T or + | Mewdoku (cat region puzzle) | 5×5 area |
| 2×2 box | Word Search (find the hidden words against the clock) | letters rain down both diagonals |
| a **Dang!** chain reaction | Micro Rush (WarioWare-style) | 3×3 zap + 8 lightning strikes |

You start small and the game opens up as you go:

| Level | Board | New |
| --- | --- | --- |
| 1 | 6×6, 4 colours | 4 in a row → Storm Sweeper |
| 2 | 6×7 | Star Bomb (magic) |
| 3 | 7×7, 5 colours | L / T / + → Mewdoku, first merge required, mashups possible |
| 4 | 7×8 | 2×2 box → Word Search |
| 5 | 7×9 | 5 in a row → Star Pegs |
| 6 | 7×9 | Moon Beam (magic) |
| 7 | 7×9 | chain reactions leave a Dang! tile |
| 8+ | 7×9, 6 colours | Saturn Orb (magic); targets and moves keep climbing, two merges needed from level 10 |

Shapes you haven't unlocked yet just match normally. Each unlock gets a "New!" card the first time.

Mashups are fused games, not reskins:

| Mashup | How it plays |
| --- | --- |
| Peg Sweeper | Star Pegs where some plain pegs are hidden storm clouds (hitting one costs a ball) and number pegs count the clouds nearby. Read the numbers and aim around the storm. |
| Cat Sweeper | A Mewdoku with no colours: one cat per row and column, no touching, and number squares say how many cats touch them. Just enough numbers for one answer. One cat starts already in its right spot, and **Auto ✕** dots every square that can't hold a cat (ruled out by a placed cat, or next to a number that already has all its cats). |
| Word Sweeper | Three words are buried under clouds. Each dig shows a letter, or a number counting the buried letters around it. Dig up every word before you run out of digs. |
| Cat Pegs | A Mewdoku grid sits under the bins. Pick a row, shoot, and the bin the ball lands in picks the column for your cat. |
| Letter Pegs | Hit the letter pegs in spelling order to answer a clue. Hitting the wrong letters costs a ball. |
| Micro Sweeper | A small Storm Sweeper at WarioWare speed: every dig has to land within a 3-second fuse. |
| Peg Rush | Every shot comes with an order ("Hit 2 orange!", "Catch it!", "Blue only!") and 5 seconds to fire. |
| Cat Snap | Mewdoku against the fuse: a row lights up and you have 5 seconds to tap where its cat goes. |
| Word Rush | Rapid 5-second word microgames: unscramble, fill the gap, spot the real word, answer the clue, type it out. |
| Word Mewdoku | Each colour has a letter. Read top to bottom, the cats spell the clue's answer, so solving the clue tells you which colour each row's cat is in. |

Chain reactions call out **Dang!**, then Lovely!, Magical!, Spellbinding!. Every level needs points **and** blasts, so some days the storm just wins.

## Storm Sweeper

Minesweeper under rain clouds. Some clouds hide lightning; numbers count the lightning clouds touching each square. Tap to clear, long-press (or switch to flag mode) to flag. Your first tap is always safe, and every board is generated so it can be cleared with logic alone, with no 50/50 guesses. Boards grow from 6×6 with just 2 bolts to 7×7 with 5 and 8×8 with 9, against a fuse. Catnip Tea adds a heart, Honey Toast adds time, the Cozy Scarf pre-flags two bolts, and the Saturn Guardian Uniform gives an extra heart in every Sweeper game.

## Magic tiles

Magic tiles explode with no mini-game. Star Bombs and Moon Beams keep their tile's colour and wear a little star or cross badge: match them like any tile and they go off. The Saturn Orb has no colour: swap it with any tile to set it off.

| Made by | Magic tile | Explosion |
| --- | --- | --- |
| a swap that makes two matches at once, or a 3-step chain | Star Bomb | the 3×3 around it |
| 6 in a row, or a 4-step chain | Moon Beam | moonbeams down its whole row and column |
| a 7+ tile match, or a 5-step chain | Saturn Orb | every tile of the colour it's swapped with |

Swap two magic tiles together for a giant combo: Star + Star is a **Rainbow Bomb** (the whole board, with rainbows flooding the screen), Star + Beam a **Moon Cross** (three rows and three columns), Beam + Beam a **Double Moon** (row, column and both diagonals), Orb + Star or Beam a **Saturn Storm** (every tile of the most common colour turns into that magic tile and they all go off), and Orb + Orb a **Total Eclipse** (the whole board). Magic tiles caught in any blast go off too, so chain reactions cascade.

## Blasts and treasure

Winning a mini-game doesn't just pop tiles; each kind delivers its blast its own way. Word Search rains letters from the sky that smash into the board, Star Pegs fires a pinball that ricochets from tile to tile, Storm Sweeper rolls storm clouds down the row and column and strikes them with lightning, Mewdoku sends cats pouncing across the area, and Micro Rush calls down lightning and flings microgame props. Mashups run both at once (`js/blastfx.js`).

About once every 200 refills a **treasure chest** drops in with the new tiles. It never matches and blasts can't break it; clear the tiles beneath it to bring it down. When it reaches the bottom row it bursts in a fountain of coins and gives coins, lumber, fabric, seeds and sometimes a planter kit, then hands you a bonus Plinko ball. Drag to aim and drop it into a prize chute. The slim gold chute in the middle (about a 1 in 17 shot) is the **Saturn Jackpot**: 1000 coins, 25 star shards, a stack of materials and seeds, and a screen that goes completely wild.

## Micro Rush

The first link of a chain reaction (the **Dang!** callout) leaves a Dang! tile behind, at most two on the board at a time. Tap it for Micro Rush: 4 to 6 WarioWare-style microgames in a row, drawn at random from the whole arcade library (every theme except the bosses), each a little faster than the last. You have 3 hearts (Catnip Tea adds one).

The microgames are: Patch it! (tape the roof leaks), Pop 'em!, Stop! (needle in the gold), Stoke it! (mash to light the fire), Find it! (the odd cat out), How many?, Catch! (bucket under the drips), Stay dry!, Swat!, Shh! (don't touch anything), Light 'em! (candles in order), Match! and Shut it! (drag the curtain). They live in `js/minigames/micro.js`; each one is a small `setup(api)` function, so adding more is easy.

## Mewdoku rules (mini-game and arcade)

An N×N board split into N coloured regions, following Meowdoku's rules. Place exactly **one piece in every row, every column and every coloured region**, and no two pieces may **touch, not even diagonally**. Each puzzle starts with one piece locked in place. Tap a square to place a piece (the pieces still to place sit in a tray above the board; switch to ✕ mode to mark squares, then tap a ✕ again to place), and tap a placed piece to pick it up. Placing a piece that breaks a rule costs one of 3 hearts, and the board says which rule it broke. Undo, Restart, an optional Auto ✕ that marks squares ruled out by placed pieces, and a hint that points at the next square logic can prove without placing anything.

Every puzzle has exactly one solution and can be solved by logic alone, with no guessing: `js/meowdoku-engine.js` generates puzzles and checks them with a solver that only uses human-style deductions. The cat tile's mini-game plays 5×5 and 6×6 boards with cats.

## The arcade cabinet

Buy the cabinet from the phone at night and it holds two cartridges.

### Magical Mewdoku

Mewdoku with a different magical girl for each region. 100 levels from 5×5 up to 10×10, ordered by how many rounds of deduction each needs. They are pre-generated by `node tools/make_meowdoku_levels.mjs` into `js/arcade/meowdoku-levels.js`, so every player gets the same puzzles and leaderboard times are comparable. Hints cost coins and add 15 seconds. Times go to a shared leaderboard (per level, plus an overall ranking by levels cleared, then total time).

### Star Pegs

A Peggle-style cartridge with 200 levels: 20 themed peg layouts (Heart, Saturn, Kitty, Spiral, Cabin, D A N G...) across 10 tiers that add more oranges, a faster bucket and, later on, slowly spinning layouts. Clear every orange peg with 10 balls (12 in the first 20 levels).

- A rounded bucket slides along the bottom: land the ball in it for a free ball.
- Points: blue 10, orange 100, purple 500, times a multiplier that climbs as the oranges go (x2, x3, x5, x10). A single shot worth 2,500 / 7,500 / 12,500 earns free balls. One purple bonus peg moves somewhere new every shot.
- Two green pegs per level each give a random power-up for the rest of that shot and the next two: Super Guide, Spooky Ball, Multiball, Fireball, Moon Ball, Flippers, Wide Bucket, Star Blast, Orange Magnet and Double Points. Hitting the second green while a power is still running tops up that same power (two more shots) instead of swapping it.
- Light the last orange and it's Fever: slow motion and bonus bins worth up to 50,000.
- Stars come from your score, first clears pay coins, and the leaderboard ranks the total of your best scores.

The charged Star Pegs tile on the board plays one of these layouts too (`js/pegs/`).

### Word Search

100 timed word searches, a new theme every 20 levels: Rainy Cabin, Magical Girls, Swiftie Eras (Taylor Swift albums, songs and cats), Attic Garden and Starry Night. Grids grow from 8×8 to 12×12 and word lists from 6 to 12; words run backwards from level 26 and in every direction from level 51. Stars come from your time, hints cost coins and add 10 seconds, and times go to per-level and overall leaderboards. Levels are seeded so everyone gets the same puzzles.

### DANG! Micro Mayhem

WarioWare-style microgames back to back: a one-line command, a fuse of about 5 seconds, one quick task. You get four lives. It speeds up every five clears, and every tenth is a multi-phase boss fight that can run up to 30 seconds. **Endless** mode scores how many you clear in one run and posts it to a shared high-score leaderboard. **Sections** let you pick a set (Retro Remix, Gross-Out, Cabin Life, Magic Sport & Silly, or one of the four Funtendo sets: Mario & Blocks, Zelda & Friends, Pokémon & Crossing and Mix-Up, each ending on its own boss), play a run of its microgames and finish on its boss. Sections aren't scored; clearing one pays coins, double the first time. The **Collection** lists every microgame, and you can practise any of them, even ones you haven't met in a run yet.

The microgames come in themed sets: Retro Remix (quick-fire takes on classic video game challenges), Gross-Out (plunge the toilet, pick the nose...), Cabin Life, Magical, Sporty, Silly, Wordy, and **Funtendo**: 100+ parodies of classic Nintendo moments (Mario, Tetris, Dr. Mario, Zelda, Kirby, Metroid, Pokémon with lots of Ditto and Eevee, Animal Crossing, Duck Hunt, Punch-Out!!, Smash and more), a few with a magical-girl twist, and four bosses of their own. Each one is a small object in `js/micro/` with a `setup(api)` that builds it and a `solve(bot)` that plays it. `node tools/test_micros.mjs` (with the dev server running) plays every microgame through its own `solve()` at normal and double speed, so each one is proven winnable. Add `--touch` to play them through a real touchscreen (genuine hit-testing, pointer capture and coalesced moves, like a phone) and `--jitter 60` to make every press land a little late, like a person; a game that only a perfect bot can win shows up there. The shared engine, helpers and test bot are in `js/micro/kit.js`: `follow` fills in fast finger movements so drag-over games never miss, and swipes count the moment the finger has moved far enough.

## Your save

The game saves to the browser on your phone, and (when the Node server is running) also backs up to the server a few seconds after every change. Tap **☁** in the top bar to see your **save code**, five easy words like `moon-quilt-cocoa-fern-42`. On a new phone, after deleting the home-screen app, or in a different browser, tap **Restore my save** on the first screen (or ☁ → Restore from code) and type it in. The server keeps your latest save plus up to 8 hourly older versions to choose from. You can also download a backup file and restore from it, and the phone keeps up to 5 rolling local backups. A save that can't be read is never overwritten; it's set aside so it can be recovered.

Good to know on iPhone: the home-screen app and Safari keep separate saves, and removing the app from the home screen deletes its data. The save code is how you carry your game across.

Cloud saves live in `DATA_DIR/saves/<code>.json` on the server (the same `data` folder as the leaderboard).

## Running it

The game is static files. The leaderboard needs the small Node server in `server/` (no dependencies), which also serves the game:

```sh
node server/server.js           # http://localhost:8080, scores saved in ./data
```

Plain static hosting (for example `python3 -m http.server`) works too; the leaderboard then falls back to this-device-only.

Add `?debug` to the URL to expose `window.dang` in the console.

### Self-hosting on Unraid behind a Cloudflare Tunnel

```sh
mkdir -p /mnt/user/appdata/dang/data
docker run --rm -v /mnt/user/appdata/dang:/git alpine/git clone https://github.com/andmillionaire/Dang.git site   # first time only
docker run -d --name dang --restart unless-stopped -p 8095:8080 \
  -v /mnt/user/appdata/dang/site:/app:ro \
  -v /mnt/user/appdata/dang/data:/data \
  -e ROOT=/app -e DATA_DIR=/data \
  node:22-alpine node /app/server/server.js
```

Auto-update every 15 minutes (User Scripts plugin):

```sh
docker run --rm -v /mnt/user/appdata/dang/site:/git alpine/git pull --ff-only && docker restart dang
```

Point the tunnel's public hostname at `http://192.168.1.116:8095` and turn Rocket Loader off. The server sends `no-cache` for everything but images so updates roll out promptly (in Cloudflare, set Caching → Configuration → Browser Cache TTL to *Respect Existing Headers*; the app copes either way), refuses paths under `.git`, `server`, `data` and `deploy`, validates and rate-limits score posts, and keeps scores in `data/leaderboard.json`. `deploy/nginx.conf` remains for static-only hosting.

### Install as an app

Open the HTTPS site on a phone: tap **Install** (Android/Chrome) or Share → *Add to Home Screen* (iOS). It works offline after the first load; bump `VERSION` in `sw.js` and `js/version.js` when app files change. The service worker fills each new version's cache straight from the server, the app checks for a release whenever it comes to the front and offers a one-tap reload, and if it ever finds the server on a different version from the one running (a stuck cache), it clears its caches and reloads itself. Saves are never touched.

## Code map

| Path | What it does |
| --- | --- |
| `js/main.js` | Screens and the day/night loop, rewards, decorating, install prompt |
| `js/match3.js` | Board: matching (lines, L/T, 2×2 boxes), charged tiles, mashups, blasts, cascades |
| `js/blastfx.js`, `js/treasure.js`, `js/plinko.js` | Themed blast effects, the treasure chest's loot and Plinko bonus (physics kept pure so the odds can be tested) |
| `js/minigames/` | Storm Sweeper (+ Micro Sweeper), Peg/Letter/Cat Pegs, Peg Sweeper, Mewdoku (+ Word Mewdoku), Word Search, Cat Sweeper, Word Sweeper, Micro Rush (+ Word Rush), Cat Snap; `index.js` maps tiles and pairs to games |
| `js/meowdoku-engine.js`, `js/meowdokuboard.js` | Mewdoku generator, uniqueness and logic solvers, and the playable board |
| `js/arcade/` | The cabinet: Magical Mewdoku (pre-generated levels) and Micro Mayhem |
| `js/micro/` | The arcade's microgames by theme, plus `kit.js` (engine, helpers, test bot) |
| `tools/` | Icon and Mewdoku level generators, and the microgame test harness |
| `js/leaderboard.js`, `server/server.js` | Leaderboard client (with offline fallback) and the Node server |
| `js/hero.js`, `js/herodata.js`, `js/creator.js` | Layered character art, creator, wardrobe perks |
| `js/bedroom.js`, `js/cabin.js`, `js/farm.js` | Morning, night cabin and the four-wall attic farm, drawn in code |
| `js/pantry.js` | Selling crops, crafting boosts, and the boost prompt before mini-games |
| `js/phone.js`, `js/wardrobe.js` | Night-time phone ordering and the wardrobe |
| `js/data.js` | Tunables: levels, crops, catalog, decor, wardrobe, `DELIVERY_CONTACT` |
| `js/spritedata.js`, `js/sprites.js` | Hand-made pixel sprites as character grids |
| `js/audio.js` | Synthesized rain ambience and sound effects |

Progress is saved to `localStorage`.
