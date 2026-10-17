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

## Charged tiles and mini-games

Bigger match shapes leave a charged tile on the board. Tap it and the board morphs into its mini-game. Win and it blasts. Lose and it fizzles.

| Shape | Tile / game | Blast |
| --- | --- | --- |
| 4 in a row | Tic-Tac-Toe | its row and column |
| 5 in a row | Star Pegs (Peggle-style) | every tile of the most common colour |
| L, T or + | Mewdoku (cat sudoku) | 5×5 area |
| 2×2 box | Word Square | both diagonals |

Swipe two charged tiles together for a **mashup**: Peg-Tac-Toe, Cat-Tac-Toe, Tic-Tac-Clue, Cat Pegs, Letter Pegs or Wordoku. Two of the same kind give a *Supercharged* version that clears the whole board. Every level needs points **and** blasts, so some days the storm just wins.

## Arcade: Starlight Sudoku

A sudoku with nine magical-girl portraits, 100 levels (4×4 → 6×6 → 9×9, fewer givens as you go). Every level is generated from a fixed seed, so all players get the same puzzle, and each one is checked to have exactly one solution. Hints cost coins and add 15 seconds to your time. Times go to a shared leaderboard (per level, plus overall ranking by levels cleared, then total time).

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

## Code map

| Path | What it does |
| --- | --- |
| `js/main.js` | Screens and the day/night loop, rewards, decorating, install prompt |
| `js/match3.js` | Board: matching (lines, L/T, 2×2 boxes), charged tiles, mashups, blasts, cascades |
| `js/minigames/` | Tic-Tac-Toe, Star Pegs (+ Peg-Tac-Toe, Letter Pegs, Cat Pegs), Mewdoku (+ Wordoku), Word Square, Cat-Tac-Toe, Tic-Tac-Clue; `index.js` maps tiles and pairs to games |
| `js/sudoku.js`, `js/sudokuboard.js` | Seeded sudoku generator/solver and the shared grid UI |
| `js/arcade/` | Starlight Sudoku: level curve and arcade screen |
| `js/leaderboard.js`, `server/server.js` | Leaderboard client (with offline fallback) and the Node server |
| `js/hero.js`, `js/herodata.js`, `js/creator.js` | Layered character art, creator, wardrobe perks |
| `js/bedroom.js`, `js/cabin.js`, `js/farm.js` | Morning, night cabin and attic scenes, drawn in code |
| `js/phone.js`, `js/wardrobe.js` | Night-time phone ordering and the wardrobe |
| `js/data.js` | Tunables: levels, crops, catalog, decor, wardrobe, `DELIVERY_CONTACT` |
| `js/spritedata.js`, `js/sprites.js` | Hand-made pixel sprites as character grids |
| `js/audio.js` | Synthesized rain ambience and sound effects |

Progress is saved to `localStorage`.
