import { MICROS, WORD_MICROS } from '../minigames/micro.js';
import classic from './classic.js';
import gross from './gross.js';
import cozy from './cozy.js';
import wild from './wild.js';
import funMario from './fun-mario.js';
import funZelda from './fun-zelda.js';
import funPoke from './fun-poke.js';
import funMix from './fun-mix.js';

// Every microgame in the arcade, by theme.
export const THEMES = {
  classic: 'Retro Remix',
  gross: 'Gross-Out',
  cozy: 'Cabin Life',
  magic: 'Magical',
  sport: 'Sporty',
  silly: 'Silly',
  word: 'Wordy',
  funtendo: 'Funtendo',
};

export const ALL = [...MICROS, ...WORD_MICROS, ...classic, ...gross, ...cozy, ...wild, ...funMario, ...funZelda, ...funPoke, ...funMix];
