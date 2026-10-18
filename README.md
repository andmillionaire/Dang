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

The **Pantry** sells crops for coins (wheat 3, cotton 5, flowers 8, pumpkin 14) and crafts them into mini-game boosts: Catnip Tea (+1 heart), Pumpkin Snack (+2 balls), Honey Toast (+30 s in Word Square, or a bigger letter tray in Word-Tac-Toe), Cozy Scarf (the storm plays worse) and Rainbow Jam (a second chance). When a charged tile starts a mini-game you're offered the boosts that fit it. Prices and recipes live in `js/data.js`.

## Charged tiles and mini-games

Bigger match shapes leave a charged tile on the board. Tap it and the board morphs into its mini-game. Win and it blasts. Lose and it fizzles.

| Shape | Tile / game | Blast |
| --- | --- | --- |
| 4 in a row | Tic-Tac-Toe | its row and column |
| 5 in a row | Star Pegs (Peggle-style) | every tile of the most common colour |
| L, T or + | Mewdoku (cat region puzzle) | 5×5 area |
| 2×2 box | Word Square | both diagonals |
| a **Dang!** chain reaction | Micro Rush (WarioWare-style) | 3×3 zap + 8 lightning strikes |

You start small and the game opens up as you go:

| Level | Board | New |
| --- | --- | --- |
| 1 | 6×6, 4 colours, no blast needed | 4 in a row → Tic-Tac-Toe |
| 2 | 6×7 | first blast required |
| 3 | 7×7, 5 colours | L / T / + → Mewdoku |
| 4 | 7×8 | 2×2 box → Word Square |
| 5 | 7×9 | 5 in a row → Star Pegs |
| 6 | 7×9 | mashups |
| 7+ | 7×9, 6 colours from level 8 | chain reactions leave a Dang! tile; targets, moves and blasts keep climbing |

Shapes you haven't unlocked yet just match normally. Each unlock gets a "New!" card the first time.

Swipe two charged tiles together for a **mashup**. These are fused games, not reskins:

| Mashup | How it plays |
| --- | --- |
| Peg-Tac-Toe | Drop balls Plinko-style. The 9 bins at the bottom are the tic-tac-toe squares; where the ball lands is where your ✕ goes. |
| Cat-Tac-Toe | A duel on a Mewdoku board: you and the storm take turns placing cats, and every cat must obey Mewdoku rules against all of them. Whoever runs out of legal squares loses. |
| Word-Tac-Toe | Place letters from your tray on the 3×3 grid. The first to make a real 3-letter word along any line wins. |
| Cat Pegs | A Mewdoku grid sits under the bins. Pick a row, shoot, and the bin the ball lands in picks the column for your cat. |
| Letter Pegs | Hit the letter pegs in spelling order to answer a clue. Hitting the wrong letters costs a ball. |
| Micro-Tac-Toe | Every square hides a microgame. Win it and your ✕ goes there; lose and the storm steals the square. |
| Peg Rush | Every shot comes with an order ("Hit 2 orange!", "Catch it!", "Blue only!") and 5 seconds to fire. |
| Cat Snap | Mewdoku against the fuse: a row lights up and you have 5 seconds to tap where its cat goes. |
| Word Rush | Rapid 5-second word microgames: unscramble, fill the gap, spot the real word, answer the clue, type it out. |
| Word Mewdoku | Each colour has a letter. Read top to bottom, the cats spell the clue's answer, so solving the clue tells you which colour each row's cat is in. |

Two of the same kind give a *Supercharged* version that clears the whole board. Chain reactions call out **Dang!**, then Lovely!, Magical!, Spellbinding!. Every level needs points **and** blasts, so some days the storm just wins.

## Micro Rush

The first link of a chain reaction (the **Dang!** callout) leaves a Dang! tile behind, at most two on the board at a time. Tap it for Micro Rush: 4 to 6 WarioWare-style microgames in a row, each with a one-line command and a 5-second fuse, and each a little faster than the last. You have 3 hearts (Catnip Tea adds one).

The microgames are: Patch it! (tape the roof leaks), Pop 'em!, Stop! (needle in the gold), Stoke it! (mash to light the fire), Find it! (the odd cat out), How many?, Catch! (bucket under the drips), Stay dry!, Swat!, Shh! (don't touch anything), Light 'em! (candles in order), Match! and Shut it! (drag the curtain). They live in `js/minigames/micro.js`; each one is a small `setup(api)` function, so adding more is easy.

## Mewdoku rules (mini-game and arcade)

An N×N board split into N coloured regions, following Meowdoku's rules. Place exactly **one piece in every row, every column and every coloured region**, and no two pieces may **touch, not even diagonally**. Each puzzle starts with one piece locked in place. Tap a square to place a piece (the pieces still to place sit in a tray above the board; switch to ✕ mode to mark squares, then tap a ✕ again to place), and tap a placed piece to pick it up. Placing a piece that breaks a rule costs one of 3 hearts, and the board says which rule it broke. Undo, Restart, an optional Auto ✕ that marks squares ruled out by placed pieces, and a hint that points at the next square logic can prove without placing anything.

Every puzzle has exactly one solution and can be solved by logic alone, with no guessing: `js/meowdoku-engine.js` generates puzzles and checks them with a solver that only uses human-style deductions. The cat tile's mini-game plays 5×5 and 6×6 boards with cats.

## The arcade cabinet

Buy the cabinet from the phone at night and it holds two cartridges.

### Magical Mewdoku

Mewdoku with a different magical girl for each region. 100 levels from 5×5 up to 10×10, ordered by how many rounds of deduction each needs. They are pre-generated by `node tools/make_meowdoku_levels.mjs` into `js/arcade/meowdoku-levels.js`, so every player gets the same puzzles and leaderboard times are comparable. Hints cost coins and add 15 seconds. Times go to a shared leaderboard (per level, plus an overall ranking by levels cleared, then total time).

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

Point the tunnel's public hostname at `http://192.168.1.116:8095` and turn Rocket Loader off. The server sends `no-cache` for `index.html`, `sw.js` and the manifest so updates roll out promptly, refuses paths under `.git`, `server`, `data` and `deploy`, validates and rate-limits score posts, and keeps scores in `data/leaderboard.json`. `deploy/nginx.conf` remains for static-only hosting.

### Install as an app

Open the HTTPS site on a phone: tap **Install** (Android/Chrome) or Share → *Add to Home Screen* (iOS). It works offline after the first load; bump `VERSION` in `sw.js` when app files change.

### DANG! Micro Mayhem

WarioWare-style microgames back to back: a one-line command, a fuse of 5 seconds (bosses up to 15), one quick task. You get four lives. It speeds up every five clears and throws a boss every tenth. Your score is how many you clear in one run, and it goes to a shared high-score leaderboard. Every microgame you meet is added to the **Collection**, where you can practise it.

The microgames come in themed sets: Retro Remix (quick-fire takes on classic video game challenges), Gross-Out (plunge the toilet, pick the nose...), Cabin Life, Magical, Sporty, Silly and Wordy. Each one is a small object in `js/micro/` with a `setup(api)` that builds it and a `solve(bot)` that plays it. `node tools/test_micros.mjs` (with the dev server running) plays every microgame through its own `solve()` at normal and double speed, so each one is proven winnable. The shared engine, helpers and test bot are in `js/micro/kit.js`.

## Code map

| Path | What it does |
| --- | --- |
| `js/main.js` | Screens and the day/night loop, rewards, decorating, install prompt |
| `js/match3.js` | Board: matching (lines, L/T, 2×2 boxes), charged tiles, mashups, blasts, cascades |
| `js/minigames/` | Tic-Tac-Toe, Star Pegs (+ Peg-Tac-Toe, Letter Pegs, Cat Pegs), Mewdoku (+ Word Mewdoku), Word Square, Cat-Tac-Toe, Word-Tac-Toe, Micro Rush (+ Word Rush), Micro-Tac-Toe, Cat Snap; `index.js` maps tiles and pairs to games |
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
