# Dang: Rainy Cabin

A cozy, pixel-art match-3 for phones, played from a cabin you can't leave because it won't stop raining.

The twist: **big matches don't just go off.** Match 5 or more tiles at once (a long line, or an L/T shape) and the match is held, crackling, while you play the storm at **tic-tac-toe**. Win and it detonates in a 5×5 Storm Blast. Lose or stalemate and it fizzles. Every level needs points *and* a number of Storm Blasts, so some levels can't be won no matter how well you match.

Winning levels earns coins. Coins buy seeds for the leaky attic farm (unlocked after level 2), and the crops are the only source of the supplies you need to decorate the cabin.

## Play / run locally

No build step and no dependencies, just static files.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Add `?debug` to the URL to expose `window.dang` (state + board) in the console.

## Install as an app

Installing needs HTTPS (localhost works too). Push to `main` and the included workflow deploys to GitHub Pages. In the repo, set **Settings → Pages → Source** to **GitHub Actions** once. Then open the site on a phone and either:

- **Android / Chrome:** tap the in-game **Install** button, or use *Add to Home screen*.
- **iOS / Safari:** Share → *Add to Home Screen*.

### Self-hosting (Unraid + Cloudflare Tunnel)

```sh
mkdir -p /mnt/user/appdata/dang
docker run --rm -v /mnt/user/appdata/dang:/git alpine/git clone https://github.com/andmillionaire/Dang.git site
docker run -d --name dang --restart unless-stopped -p 8088:80 \
  -v /mnt/user/appdata/dang/site:/usr/share/nginx/html:ro \
  -v /mnt/user/appdata/dang/site/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:alpine
```

Auto-update every 15 minutes (User Scripts plugin):

```sh
docker run --rm -v /mnt/user/appdata/dang/site:/git alpine/git pull --ff-only && docker exec dang nginx -s reload
```

In Cloudflare Zero Trust → Tunnels → Public Hostname, point `game.example.com` at `http://192.168.1.116:8088` (or `http://dang:80` if cloudflared shares a Docker network with the container). `deploy/nginx.conf` sends `no-cache` for `index.html`, `sw.js` and the manifest so Cloudflare doesn't hold back updates. Turn Rocket Loader off for the hostname.

It works offline after the first load. When you change app files, bump `VERSION` in `sw.js` so players get the update.

## Code map

| File | What it does |
| --- | --- |
| `js/main.js` | Screens, HUD, level flow, rewards, decorating, install prompt |
| `js/match3.js` | Board logic (matching with L/T merging, cascades, refills, shuffles), input, rendering, and holding big matches until the mini-game finishes |
| `js/tictactoe.js` | The mini-game. The storm plays a perfect move with probability `aiSkill`, otherwise a random one. Ties replay twice, then the charge fizzles |
| `js/data.js` | Tunables: `levelConfig(n)`, crops, decor prices, planter prices |
| `js/cabin.js`, `js/farm.js` | The cabin and attic scenes, drawn in code at 144×208 logical pixels |
| `js/rainview.js`, `js/bgrain.js` | Rain through windows, lightning, background rain |
| `js/spritedata.js`, `js/sprites.js` | Hand-made pixel sprites as character grids |
| `js/audio.js` | Synthesized rain ambience and sound effects (no audio files) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA shell |

### Swapping the mini-game

The match-3 board only knows that `hooks.onBigMatch(board)` returns a promise resolving to `'win'`, `'lose'` or `'draw'` (see `main.js`). To try a different mini-game, write a module with the same contract and swap it in there.

Progress is saved to `localStorage`.
