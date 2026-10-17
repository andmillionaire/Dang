import { PAL, TILE_ROWS, CROP_ROWS, ICON_ROWS } from './spritedata.js';
export { TILE_COLORS } from './spritedata.js';

function build(rows, recolor) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      x.fillStyle = recolor ? recolor(ch) : PAL[ch];
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

const urls = {};
export function iconURL(name) {
  return urls[name] || (urls[name] = ICONS[name].toDataURL());
}
