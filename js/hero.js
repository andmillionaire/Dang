import * as D from './herodata.js';
import { S } from './state.js';
import { ACC_SPR } from './sprites.js';
import { WARDROBE, SATURN_SET } from './data.js';

export const W = 16, H = 27;

// Every creator choice, in display order.
const idx = arr => arr.map((_, i) => i);
export const CHOICES = [
  { key: 'gender', label: 'I am a…', values: ['girl', 'boy'], names: ['Girl', 'Boy'] },
  { key: 'skin', label: 'Skin', values: idx(D.SKINS), swatch: i => D.SKINS[i][0] },
  { key: 'hair', label: 'Hairstyle', values: Object.keys(D.HAIR), names: ['Long', 'Bob', 'Twin tails', 'Ponytail', 'Short', 'Fluffy'] },
  { key: 'hairColor', label: 'Hair colour', values: idx(D.HAIR_COLORS), names: D.HAIR_COLORS.map(c => c[0]), swatch: i => D.HAIR_COLORS[i][1] },
  { key: 'eyes', label: 'Eyes', values: ['round', 'sparkly', 'sleepy'], names: ['Round', 'Sparkly', 'Sleepy'] },
  { key: 'eyeColor', label: 'Eye colour', values: idx(D.EYE_COLORS), names: D.EYE_COLORS.map(c => c[0]), swatch: i => D.EYE_COLORS[i][1] },
  { key: 'mouth', label: 'Mouth', values: Object.keys(D.MOUTHS), names: ['Smile', 'Grin', 'Calm', 'Cat'] },
  { key: 'cheeks', label: 'Cheeks', values: Object.keys(D.CHEEKS), names: ['Plain', 'Blush', 'Freckles'] },
  { key: 'top', label: 'Top', values: idx(D.TOPS), names: D.TOPS.map(c => c[0]), swatch: i => D.TOPS[i][1] },
  { key: 'bottom', label: 'Bottoms', values: Object.keys(D.BOTTOMS), names: ['Skirt', 'Shorts', 'Trousers'] },
  { key: 'bottomColor', label: 'Bottoms colour', values: idx(D.BOTTOM_COLORS), names: D.BOTTOM_COLORS.map(c => c[0]), swatch: i => D.BOTTOM_COLORS[i][1] },
  { key: 'shoes', label: 'Shoes', values: idx(D.SHOE_COLORS), names: D.SHOE_COLORS.map(c => c[0]), swatch: i => D.SHOE_COLORS[i][1] },
  { key: 'acc', label: 'Accessory', values: Object.keys(D.ACCS), names: ['None', 'Glasses', 'Flower', 'Beanie', 'Star pin'] },
];

export function defaultHero(gender = 'girl') {
  return gender === 'boy'
    ? { name: '', gender, skin: 1, hair: 'short', hairColor: 0, eyes: 'round', eyeColor: 0, mouth: 'smile', cheeks: 'none', top: 3, bottom: 'pants', bottomColor: 0, shoes: 0, acc: 'none' }
    : { name: '', gender, skin: 1, hair: 'long', hairColor: 0, eyes: 'sparkly', eyeColor: 3, mouth: 'smile', cheeks: 'blush', top: 0, bottom: 'skirt', bottomColor: 0, shoes: 0, acc: 'none' };
}

export function randomHero(keep = {}) {
  const h = {};
  for (const c of CHOICES) h[c.key] = c.values[(Math.random() * c.values.length) | 0];
  return { ...h, ...keep };
}

const cache = new Map();

// Composite the character into a 16x27 canvas. outfit: null (own clothes) | 'pajamas' | 'sailor' | 'violet'.
export function heroSprite(hero, { outfit = null, closed = false } = {}) {
  const key = JSON.stringify([hero, outfit, closed]);
  if (cache.has(key)) return cache.get(key);
  const o = outfit ? D.OUTFITS[outfit] : null;
  const skin = D.SKINS[hero.skin] || D.SKINS[1];
  const hair = D.HAIR_COLORS[hero.hairColor] || D.HAIR_COLORS[0];
  const top = D.TOPS[hero.top] || D.TOPS[0];
  const bottomShape = (o && o.bottomShape) || hero.bottom;
  const pal = {
    k: '#1a1220', 1: skin[0], 2: skin[1], 3: hair[1], 4: hair[2],
    5: (D.EYE_COLORS[hero.eyeColor] || D.EYE_COLORS[0])[1], w: '#fff4e0', f: '#f08ab0', r: '#d0463c', y: '#ffe27a',
    7: o ? o.top : top[1], 8: o ? o.collar : top[2], 9: o ? o.bow : top[3],
    0: o ? o.bottom : D.BOTTOM_COLORS[hero.bottomColor][1],
    6: (o && o.legs) || skin[0],
    z: o ? o.shoes : D.SHOE_COLORS[hero.shoes][1],
    A: top[1], a: top[2],
  };
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const layer = L => {
    if (!L) return;
    L.rows.forEach((row, j) => {
      for (let i = 0; i < W; i++) {
        const ch = row[i];
        if (ch === '.' || !pal[ch]) continue;
        x.fillStyle = pal[ch];
        x.fillRect(i, L.y + j, 1, 1);
      }
    });
  };
  const hs = D.HAIR[hero.hair] || D.HAIR.long;
  layer(hs.back);
  layer(D.HEAD);
  layer(D.TORSO);
  layer(D.BOTTOMS[bottomShape]);
  layer(D.SHOES);
  layer(D.EYES[closed ? 'closed' : hero.eyes]);
  if (hero.gender === 'girl' && !closed) layer(D.LASHES);
  layer(D.MOUTHS[hero.mouth]);
  layer(D.CHEEKS[hero.cheeks]);
  layer(hs.front);
  if (outfit !== 'pajamas') layer(D.ACCS[hero.acc]);
  cache.set(key, c);
  return c;
}

export const equipped = () => S.wardrobe.equip;
export const hasItem = id => Object.values(S.wardrobe.equip).includes(id);
export const fullSaturn = () => SATURN_SET.every(hasItem);
export const kid = () => (S.hero && S.hero.gender === 'boy' ? 'magical boy' : 'magical girl');

// Draw the character with wardrobe extras. (x, y) is the sprite's top-left.
export function drawHero(ctx, x, y, { outfit, closed = false, now = performance.now(), magic = true } = {}) {
  if (!S.hero) return;
  const eq = S.wardrobe.equip;
  const fit = outfit !== undefined ? outfit : eq.outfit === 'casual' ? null : eq.outfit;
  const blink = !closed && Math.floor(now / 100) % 40 === 0;
  if (magic && fullSaturn()) {
    for (let i = 0; i < 6; i++) {
      const a = now / 700 + (i * Math.PI) / 3;
      ctx.fillStyle = i % 2 ? '#a46ad0' : '#e0c8ff';
      ctx.fillRect(Math.round(x + 8 + Math.cos(a) * 11), Math.round(y + 14 + Math.sin(a) * 15), 1, 1);
    }
  }
  ctx.drawImage(heroSprite(S.hero, { outfit: fit, closed: closed || blink }), x, y);
  if (!magic || fit === 'pajamas') return;
  for (const slot of ['head', 'brooch', 'held']) {
    const a = eq[slot] && ACC_SPR[eq[slot]];
    if (a) ctx.drawImage(a.img, x + a.x, y + a.y);
  }
}

export function perks() {
  const has = hasItem;
  const full = fullSaturn();
  return {
    scoreMult: (has('tiara') ? 1.1 : 1) * (full ? 1.25 : 1),
    extraMoves: (has('sailor') ? 2 : 0) + (has('violet') ? 3 : 0),
    bigBlasts: has('ringtiara'),
    tieWins: has('violet'),
    glaive: has('glaive'),
    retry: has('crystal'),
    easier: has('heart') ? 0.15 : 0,
    wand: has('wand'),
    bonusCoins: has('bow') ? 5 : 0,
    full,
  };
}

export function unlockMet(item) {
  const u = item.unlock;
  if (!u) return true;
  if (u.miniWins) return S.stats.miniWins >= u.miniWins;
  if (u.day) return S.day >= u.day;
  if (u.blasts) return S.stats.blasts >= u.blasts;
  if (u.threeStars) return Object.values(S.stars).filter(s => s >= 3).length >= u.threeStars;
  return true;
}

export function unlockText(item) {
  const u = item.unlock;
  if (!u) return '';
  if (u.miniWins) return `Win ${u.miniWins} mini-games (${S.stats.miniWins}/${u.miniWins})`;
  if (u.day) return `Reach day ${u.day} (now day ${S.day})`;
  if (u.blasts) return `Set off ${u.blasts} Storm Blasts (${S.stats.blasts}/${u.blasts})`;
  if (u.threeStars) return `3-star ${u.threeStars} levels (${Object.values(S.stars).filter(s => s >= 3).length}/${u.threeStars})`;
  return '';
}

export { WARDROBE };
