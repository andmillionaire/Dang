import { CROPS, SPOT_COUNT } from './data.js';

const KEY = 'dang-cabin-v1';

const fresh = () => ({
  v: 2,
  hero: null, // set by the character creator
  coins: 0,
  shards: 0,
  maxLevel: 1,
  stars: {},
  day: 1,
  phase: 'morning', // morning -> day (matching) -> night (phone, farm, decor) -> sleep -> morning
  today: { played: 0, earned: 0 },
  crops: { wheat: 0, cotton: 0, flowers: 0, pumpkin: 0 },
  seeds: { wheat: 1, cotton: 0, flowers: 0, pumpkin: 0 },
  mats: { lumber: 0, fabric: 0, kit: 0 },
  decor: {},
  // 16 planter spots (4 per wall). level 0 = empty spot.
  planters: Array.from({ length: SPOT_COUNT }, (_, i) => ({ level: i === 0 ? 1 : 0, crop: null, nights: 0 })),
  boosts: {},
  wardrobe: { owned: { casual: true }, equip: { head: null, outfit: 'casual', held: null, brooch: null } },
  stats: { miniWins: 0, blasts: 0 },
  arcade: { owned: false, meowdoku: { unlocked: 1, best: {} }, micro: { best: 0, runs: 0, seen: {}, cleared: {}, sections: {} }, pegs: { unlocked: 1, best: {} }, wordsearch: { unlocked: 1, best: {} } },
  playerId: null,
  seen: {},
  sound: true,
});

// v1 saves had real-time crops and crop "supplies" only.
function migrate(saved) {
  const base = fresh();
  const s = { ...base, ...saved };
  if (!saved.v) {
    s.crops = { ...base.crops, ...(saved.supplies || {}) };
    s.plots = (saved.plots || base.plots).map(p => (p.crop ? { crop: p.crop, nights: CROPS[p.crop].nights } : { crop: null, nights: 0 }));
    s.phase = 'morning';
    delete s.supplies;
    delete s.farmUnlocked;
  }
  // One-wall farm (plots/plotsOwned) -> four walls of planters.
  if (saved.plots && !saved.planters) {
    s.planters = base.planters.map((p, i) => (i < (saved.plotsOwned || 1) ? { level: 1, ...(saved.plots[i] || { crop: null, nights: 0 }) } : { level: 0, crop: null, nights: 0 }));
    delete s.plots;
    delete s.plotsOwned;
  }
  for (const k of ['today', 'crops', 'seeds', 'mats', 'stats', 'wardrobe', 'arcade', 'boosts']) s[k] = { ...base[k], ...s[k] };
  s.arcade.meowdoku = { ...base.arcade.meowdoku, ...s.arcade.meowdoku };
  s.arcade.micro = { ...base.arcade.micro, ...s.arcade.micro };
  s.arcade.pegs = { ...base.arcade.pegs, ...s.arcade.pegs };
  s.arcade.wordsearch = { ...base.arcade.wordsearch, ...s.arcade.wordsearch };
  s.wardrobe.equip = { ...base.wardrobe.equip, ...s.wardrobe.equip };
  s.v = 2;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {}
  return fresh();
}

export const S = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
}
