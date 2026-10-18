import * as sweep from './sweeper.js';
import * as pegs from './peggle.js';
import * as mew from './mewdoku.js';
import * as ws from './wordsearch.js';
import * as catSweep from './catsweeper.js';
import * as wordSweep from './wordsweeper.js';
import * as micro from './micro.js';
import { playStarPegs } from '../pegs/engine.js';
import { levelData } from '../pegs/levels.js';
import * as catSnap from './catsnap.js';

// Star Pegs on the board: a layout picked by difficulty from the arcade's 200 levels.
async function starPegs(o) {
  const n = Math.max(1, Math.min(200, Math.round(1 + o.difficulty * 80 + (Math.random() - 0.5) * 20)));
  const r = await playStarPegs(o.root, { level: levelData(n), sfx: o.sfx, extraBalls: 2 + (o.boost === 'snack' ? 2 : 0) });
  return r.won ? 'win' : 'lose';
}

// One mini-game per charged tile. `shape` is the match that makes it.
export const GAMES = {
  ttt:  { key: 'ttt', name: 'Storm Sweeper', shape: '4 in a row',    blast: 'strikes lightning down its row and column', play: o => sweep.play(o.root, o) },
  pegs: { key: 'pegs', name: 'Star Pegs',   shape: '5 in a row',      blast: 'clears every tile of the most common colour', play: o => starPegs(o) },
  mew:  { key: 'mew', name: 'Mewdoku',     shape: 'L, T or + shape', blast: 'blows up a 5×5 area', play: o => mew.play(o.root, o) },
  cw:   { key: 'cw', name: 'Word Search', shape: '2×2 box',         blast: 'rains letters down both diagonals', play: o => ws.play(o.root, o) },
  micro: { key: 'micro', name: 'Micro Rush', shape: 'A Dang! chain reaction', blast: 'zaps a 3×3 area and lightning-strikes 8 more tiles', play: o => micro.play(o.root, o) },
};

// Two different charged tiles swapped together.
export const MASHUPS = {
  'pegs+ttt': { key: 'pegs+ttt', name: 'Peg Sweeper',  play: o => pegs.play(o.root, { ...o, mode: 'sweep' }) },
  'mew+ttt':  { key: 'mew+ttt', name: 'Cat Sweeper',  play: o => catSweep.play(o.root, o) },
  'cw+ttt':   { key: 'cw+ttt', name: 'Word Sweeper', play: o => wordSweep.play(o.root, o) },
  'mew+pegs': { key: 'mew+pegs', name: 'Cat Pegs',     play: o => pegs.play(o.root, { ...o, mode: 'cats' }) },
  'cw+pegs':  { key: 'cw+pegs', name: 'Letter Pegs',  play: o => pegs.play(o.root, { ...o, mode: 'word' }) },
  'cw+mew':   { key: 'cw+mew', name: 'Word Mewdoku', play: o => mew.play(o.root, { ...o, wordoku: true }) },
  'micro+ttt':  { key: 'micro+ttt', name: 'Micro Sweeper', play: o => sweep.playMicro(o.root, o) },
  'micro+pegs': { key: 'micro+pegs', name: 'Peg Rush',     play: o => pegs.play(o.root, { ...o, mode: 'rush' }) },
  'micro+mew':  { key: 'micro+mew', name: 'Cat Snap',      play: o => catSnap.play(o.root, o) },
  'micro+cw':   { key: 'micro+cw', name: 'Word Rush',      play: o => micro.playWords(o.root, o) },
};

// The game for one tile, or a mashup for two. Two of the same kind play a supercharged version.
export function gameFor(kinds) {
  if (kinds.length === 1) return GAMES[kinds[0]];
  const [a, b] = [...kinds].sort();
  if (a === b) {
    const base = GAMES[a];
    return { key: base.key, name: `Supercharged ${base.name}`, super: true, play: o => base.play({ ...o, difficulty: Math.min(1, o.difficulty + 0.2) }) };
  }
  const order = ['ttt', 'pegs', 'mew', 'cw', 'micro'];
  const [x, y] = [a, b].sort((p, q) => order.indexOf(q) - order.indexOf(p));
  return MASHUPS[`${x}+${y}`];
}
