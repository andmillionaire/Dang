import { MICROS, WORD_MICROS } from '../minigames/micro.js';
import classic from './classic.js';
import gross from './gross.js';
import cozy from './cozy.js';
import wild from './wild.js';

// Every microgame in the arcade, by theme.
export const THEMES = {
  classic: 'Retro Remix',
  gross: 'Gross-Out',
  cozy: 'Cabin Life',
  magic: 'Magical',
  sport: 'Sporty',
  silly: 'Silly',
  word: 'Wordy',
};

export const ALL = [...MICROS, ...WORD_MICROS, ...classic, ...gross, ...cozy, ...wild];
