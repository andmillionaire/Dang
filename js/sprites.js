import { PAL, TILE_ROWS, CROP_ROWS, ICON_ROWS, ACCESSORY, CAT_ROWS, CAT_BREEDS, PEG_ROWS, BALL_ROWS, SPECIAL_ROWS, CHEST_ROWS, MAGIC_ROWS, GIRL_ROWS, GIRLS as GIRL_DEFS, PET_ROWS, PET_PAL } from './spritedata.js';
export { TILE_COLORS } from './spritedata.js';

export function build(rows, recolor) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const col = recolor ? recolor(ch) : PAL[ch];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i, y, 1, 1);
    }
  });
  return c;
}

const mapObj = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

export const TILES = TILE_ROWS.map(r => build(r));
export const TILES_WHITE = TILE_ROWS.map(r => build(r, () => '#fff8e0'));
export const TILES_GREY = TILE_ROWS.map(r => build(r, ch => (ch === 'k' ? '#26222c' : '#6e6878')));
export const CROPS_SPR = mapObj(CROP_ROWS, build);
export const ICONS = mapObj(ICON_ROWS, build);
ICONS.heartOff = build(ICON_ROWS.heart, ch => (ch === 'w' ? '#5a4a5a' : '#3a2a3a'));
export const ACC_SPR = mapObj(ACCESSORY, a => ({ ...a, img: build(a.rows) }));

export const CATS = CAT_BREEDS.map(b => build(CAT_ROWS, ch => b[ch] || PAL[ch]));
CAT_BREEDS.forEach((b, i) => (ICONS['cat' + i] = CATS[i]));

export const SPECIALS = mapObj(SPECIAL_ROWS, rows => build(rows, ch => ({ D: '#24305a', P: '#3a2a5c', F: '#c0507a' }[ch] || PAL[ch])));
Object.entries(SPECIALS).forEach(([k, c]) => (ICONS['sp_' + k] = c));
export const CHEST = build(CHEST_ROWS);
export const MAGIC = mapObj(MAGIC_ROWS, rows => build(rows, ch => ({ D: '#24305a', P: '#3a2a5c' }[ch] || PAL[ch])));
Object.entries(MAGIC).forEach(([k, c]) => (ICONS['mg_' + k] = c));
ICONS.chest = CHEST;

export const GIRLS = GIRL_DEFS.map(g => build(GIRL_ROWS[g.style], ch => ({ H: g.H, G: g.G, X: g.X, E: g.E, s: '#f7d4b8', m: '#d0463c' }[ch] || PAL[ch])));
GIRLS.forEach((c, i) => (ICONS['girl' + i] = c));

export const PETS = mapObj(PET_ROWS, rows => build(rows, ch => PET_PAL[ch] || PAL[ch]));
ICONS.dog = PETS.dogSit; ICONS.cat = PETS.catSit;

const peg = (main, light) => build(PEG_ROWS, ch => (ch === 'w' ? light : main));
export const PEGS = {
  blue: peg('#4f8fd0', '#9fd3f2'), blueLit: peg('#bfe6ff', '#ffffff'),
  orange: peg('#f39a3a', '#ffe27a'), orangeLit: peg('#fff0a0', '#ffffff'),
};
export const BALL = build(BALL_ROWS, ch => (ch === 'w' ? '#fff4e0' : '#a8a8c8'));

const urls = {};
export function iconURL(name) {
  return urls[name] || (urls[name] = ICONS[name].toDataURL());
}
