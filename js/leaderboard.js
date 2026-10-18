import { S, persist } from './state.js';

// Talks to the server's /api; if it can't be reached, falls back to this device's own bests.
export function playerId() {
  if (!S.playerId) {
    const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    S.playerId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => abc[b % abc.length]).join('');
    persist();
  }
  return S.playerId;
}

async function api(path, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(path, { ...opts, signal: ctl.signal, headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function localBoard(game, level) {
  const best = (S.arcade[game] || { best: {} }).best;
  const me = S.hero ? S.hero.name : 'You';
  if (level) {
    const b = best[level];
    return { online: false, top: b ? [{ rank: 1, name: me, time: b.time, you: true }] : [], you: b ? { rank: 1, time: b.time } : null, players: b ? 1 : 0 };
  }
  const done = Object.values(best);
  const total = Math.round(done.reduce((t, b) => t + b.time, 0) * 10) / 10;
  return { online: false, top: done.length ? [{ rank: 1, name: me, levels: done.length, total, you: true }] : [], you: null, players: done.length ? 1 : 0 };
}

export async function fetchBoard(game, level = 0) {
  try {
    const q = new URLSearchParams({ game, player: playerId(), ...(level ? { level } : {}) });
    return { online: true, ...(await api(`api/leaderboard?${q}`)) };
  } catch {
    return localBoard(game, level);
  }
}

export async function submitScore(game, level, time) {
  try {
    return { online: true, ...(await api('api/scores', { method: 'POST', body: JSON.stringify({ game, level, time, player: playerId(), name: S.hero ? S.hero.name : 'Anonymous' }) })) };
  } catch {
    return localBoard(game, level);
  }
}

// High-score games (the micro arcade): one best score per player.
function localScores(game) {
  const best = (S.arcade[game] || {}).best || 0;
  const me = S.hero ? S.hero.name : 'You';
  return { online: false, top: best ? [{ rank: 1, name: me, score: best, you: true }] : [], you: best ? { rank: 1, score: best } : null, players: best ? 1 : 0 };
}

export async function fetchScores(game) {
  try {
    return { online: true, ...(await api(`api/leaderboard?${new URLSearchParams({ game, player: playerId() })}`)) };
  } catch {
    return localScores(game);
  }
}

export async function submitHighScore(game, score) {
  try {
    return { online: true, ...(await api('api/scores', { method: 'POST', body: JSON.stringify({ game, score, player: playerId(), name: S.hero ? S.hero.name : 'Anonymous' }) })) };
  } catch {
    return localScores(game);
  }
}

export const fmtSecs = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
