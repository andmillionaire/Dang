import * as ttt from './tictactoe.js';
import * as pegs from './peggle.js';
import * as mew from './mewdoku.js';
import * as cw from './crossword.js';
import * as catTac from './cattactoe.js';
import * as clue from './tictacclue.js';

// One mini-game per charged tile. `shape` is the match that makes it.
export const GAMES = {
  ttt:  { name: 'Tic-Tac-Toe', shape: '4 in a row',      blast: 'clears its row and column', play: o => ttt.play(o.root, o) },
  pegs: { name: 'Star Pegs',   shape: '5 in a row',      blast: 'clears every tile of the most common colour', play: o => pegs.play(o.root, o) },
  mew:  { name: 'Mewdoku',     shape: 'L, T or + shape', blast: 'blows up a 5×5 area', play: o => mew.play(o.root, o) },
  cw:   { name: 'Word Square', shape: '2×2 box',         blast: 'clears both diagonals', play: o => cw.play(o.root, o) },
};

// Wordoku needs a 4-letter answer with no repeated letters.
const pickWord = () => {
  const ok = cw.WORDS.filter(w => w.word.length === 4 && new Set(w.word).size === 4);
  return ok[(Math.random() * ok.length) | 0];
};

// Two different charged tiles swapped together.
export const MASHUPS = {
  'pegs+ttt': { name: 'Peg-Tac-Toe',  play: o => pegs.play(o.root, { ...o, mode: 'ttt' }) },
  'mew+ttt':  { name: 'Cat-Tac-Toe',  play: o => catTac.play(o.root, o) },
  'cw+ttt':   { name: 'Tic-Tac-Clue', play: o => clue.play(o.root, o) },
  'mew+pegs': { name: 'Cat Pegs',     play: o => pegs.play(o.root, { ...o, mode: 'cats' }) },
  'cw+pegs':  { name: 'Letter Pegs',  play: o => pegs.play(o.root, { ...o, mode: 'word' }) },
  'cw+mew':   { name: 'Wordoku',      play: o => mew.play(o.root, { ...o, wordoku: pickWord() }) },
};

// The game for one tile, or a mashup for two. Two of the same kind play a supercharged version.
export function gameFor(kinds) {
  if (kinds.length === 1) return GAMES[kinds[0]];
  const [a, b] = [...kinds].sort();
  if (a === b) {
    const base = GAMES[a];
    return { name: `Supercharged ${base.name}`, super: true, play: o => base.play({ ...o, difficulty: Math.min(1, o.difficulty + 0.35) }) };
  }
  const order = ['ttt', 'pegs', 'mew', 'cw'];
  const [x, y] = [a, b].sort((p, q) => order.indexOf(q) - order.indexOf(p));
  return MASHUPS[`${x}+${y}`];
}
