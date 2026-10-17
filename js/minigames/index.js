import * as ttt from './tictactoe.js';
import * as pegs from './peggle.js';
import * as mew from './mewdoku.js';
import * as cw from './crossword.js';
import * as catTac from './cattactoe.js';
import * as wtt from './wordtactoe.js';

// One mini-game per charged tile. `shape` is the match that makes it.
export const GAMES = {
  ttt:  { key: 'ttt', name: 'Tic-Tac-Toe', shape: '4 in a row',      blast: 'clears its row and column', play: o => ttt.play(o.root, o) },
  pegs: { key: 'pegs', name: 'Star Pegs',   shape: '5 in a row',      blast: 'clears every tile of the most common colour', play: o => pegs.play(o.root, o) },
  mew:  { key: 'mew', name: 'Mewdoku',     shape: 'L, T or + shape', blast: 'blows up a 5×5 area', play: o => mew.play(o.root, o) },
  cw:   { key: 'cw', name: 'Word Square', shape: '2×2 box',         blast: 'clears both diagonals', play: o => cw.play(o.root, o) },
};

// Two different charged tiles swapped together.
export const MASHUPS = {
  'pegs+ttt': { key: 'pegs+ttt', name: 'Peg-Tac-Toe',  play: o => pegs.play(o.root, { ...o, mode: 'ttt' }) },
  'mew+ttt':  { key: 'mew+ttt', name: 'Cat-Tac-Toe',  play: o => catTac.play(o.root, o) },
  'cw+ttt':   { key: 'cw+ttt', name: 'Word-Tac-Toe', play: o => wtt.play(o.root, o) },
  'mew+pegs': { key: 'mew+pegs', name: 'Cat Pegs',     play: o => pegs.play(o.root, { ...o, mode: 'cats' }) },
  'cw+pegs':  { key: 'cw+pegs', name: 'Letter Pegs',  play: o => pegs.play(o.root, { ...o, mode: 'word' }) },
  'cw+mew':   { key: 'cw+mew', name: 'Word Mewdoku', play: o => mew.play(o.root, { ...o, wordoku: true }) },
};

// The game for one tile, or a mashup for two. Two of the same kind play a supercharged version.
export function gameFor(kinds) {
  if (kinds.length === 1) return GAMES[kinds[0]];
  const [a, b] = [...kinds].sort();
  if (a === b) {
    const base = GAMES[a];
    return { key: base.key, name: `Supercharged ${base.name}`, super: true, play: o => base.play({ ...o, difficulty: Math.min(1, o.difficulty + 0.35) }) };
  }
  const order = ['ttt', 'pegs', 'mew', 'cw'];
  const [x, y] = [a, b].sort((p, q) => order.indexOf(q) - order.indexOf(p));
  return MASHUPS[`${x}+${y}`];
}
