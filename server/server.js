// Dang server: serves the game's static files and a small leaderboard API. No dependencies.
//   node server/server.js            (PORT=8080, ROOT=repo dir, DATA_DIR=./data by default)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.env.ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 8080);
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Games with leaderboards. Timed games rank each level by fastest time; score games keep one
// high score per player (higher is better).
const GAMES = { meowdoku: { levels: 100 }, micro: { score: true, max: 999 }, starpegs: { score: true, max: 1e9 }, wordsearch: { levels: 100 } };

// ---------- storage ----------
let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
for (const g of Object.keys(GAMES)) db[g] ||= {};

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 1000);
}

// ---------- leaderboard ----------
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12) || 'Anonymous';
const validPlayer = s => typeof s === 'string' && /^[a-z0-9]{8,32}$/.test(s);

function levelBoard(game, level, player) {
  const rows = Object.entries(db[game][level] || {})
    .map(([id, r]) => ({ id, name: r.name, time: r.time }))
    .sort((a, b) => a.time - b.time);
  const you = rows.findIndex(r => r.id === player);
  return {
    top: rows.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name, time: r.time, you: r.id === player })),
    you: you >= 0 ? { rank: you + 1, time: rows[you].time } : null,
    players: rows.length,
  };
}

function overallBoard(game, player) {
  const per = new Map();
  for (const level of Object.values(db[game])) {
    for (const [id, r] of Object.entries(level)) {
      const p = per.get(id) || { id, name: r.name, levels: 0, total: 0, at: 0 };
      p.levels++;
      p.total += r.time;
      if (r.at > p.at) { p.at = r.at; p.name = r.name; }
      per.set(id, p);
    }
  }
  const rows = [...per.values()].sort((a, b) => b.levels - a.levels || a.total - b.total);
  const you = rows.findIndex(r => r.id === player);
  return {
    top: rows.slice(0, 20).map((r, i) => ({ rank: i + 1, name: r.name, levels: r.levels, total: Math.round(r.total * 10) / 10, you: r.id === player })),
    you: you >= 0 ? { rank: you + 1, levels: rows[you].levels, total: Math.round(rows[you].total * 10) / 10 } : null,
    players: rows.length,
  };
}

function scoreBoard(game, player) {
  const rows = Object.entries(db[game].scores || {})
    .map(([id, r]) => ({ id, name: r.name, score: r.score, at: r.at }))
    .sort((a, b) => b.score - a.score || a.at - b.at);
  const you = rows.findIndex(r => r.id === player);
  return {
    top: rows.slice(0, 20).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, you: r.id === player })),
    you: you >= 0 ? { rank: you + 1, score: rows[you].score } : null,
    players: rows.length,
  };
}

// Simple per-IP rate limit for score posts.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

function submit(body, ip) {
  const { game, level, player, name, time, score } = body || {};
  const spec = GAMES[game];
  if (!spec) return [400, { error: 'unknown game' }];
  if (spec.score) {
    if (!validPlayer(player)) return [400, { error: 'bad player' }];
    if (!Number.isInteger(score) || score < 1 || score > spec.max) return [400, { error: 'bad score' }];
    if (limited(ip)) return [429, { error: 'slow down' }];
    const all = (db[game].scores ||= {});
    const prev = all[player];
    const clean = cleanName(name);
    if (!prev || score > prev.score) all[player] = { name: clean, score, at: Date.now() };
    else prev.name = clean;
    save();
    return [200, { best: all[player].score, ...scoreBoard(game, player) }];
  }
  if (!Number.isInteger(level) || level < 1 || level > spec.levels) return [400, { error: 'bad level' }];
  if (!validPlayer(player)) return [400, { error: 'bad player' }];
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 3 || time > 86_400) return [400, { error: 'bad time' }];
  if (limited(ip)) return [429, { error: 'slow down' }];
  const t = Math.round(time * 10) / 10;
  const lv = (db[game][level] ||= {});
  const prev = lv[player];
  const clean = cleanName(name);
  if (!prev || t < prev.time) lv[player] = { name: clean, time: t, at: Date.now() };
  else prev.name = clean;
  save();
  return [200, { best: lv[player].time, ...levelBoard(game, level, player) }];
}

// ---------- http ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function serveStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return send(res, 400, { error: 'bad url' }); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const blocked = !file.startsWith(ROOT + path.sep) || /(^|[\\/])\./.test(path.relative(ROOT, file)) ||
    /^(server|data|deploy|node_modules)([\\/]|$)/.test(path.relative(ROOT, file));
  if (blocked) return send(res, 403, { error: 'forbidden' });
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(ROOT, 'index.html');
    const ext = path.extname(target);
    const fresh = target.endsWith('index.html') || target.endsWith('sw.js') || ext === '.webmanifest';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': fresh ? 'no-cache' : ext === '.png' ? 'public, max-age=604800' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  try { route(req, res); } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'server error' });
    else res.destroy();
  }
});

function route(req, res) {
  let url;
  try { url = new URL(req.url, 'http://local'); } catch { return send(res, 400, { error: 'bad url' }); }
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '?';

  if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
    const game = url.searchParams.get('game');
    if (!GAMES[game]) return send(res, 400, { error: 'unknown game' });
    const player = url.searchParams.get('player') || '';
    const level = Number(url.searchParams.get('level'));
    if (GAMES[game].score) return send(res, 200, scoreBoard(game, player));
    return send(res, 200, level ? levelBoard(game, level, player) : overallBoard(game, player));
  }

  if (url.pathname === '/api/scores' && req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2048) { send(res, 413, { error: 'too big' }); req.destroy(); }
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
      const [status, out] = submit(body, ip);
      send(res, status, out);
    });
    return;
  }

  if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
  serveStatic(req, res, url.pathname);
}

server.listen(PORT, () => console.log(`Dang server on :${PORT} serving ${ROOT}, data in ${DATA_DIR}`));
