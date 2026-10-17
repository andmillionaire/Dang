import { CROPS } from './data.js';

const KEY = 'dang-cabin-v1';

const fresh = () => ({
  v: 2,
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
  plots: Array.from({ length: 6 }, () => ({ crop: null, nights: 0 })),
  plotsOwned: 1,
  wardrobe: { owned: { casual: true }, equip: { head: null, outfit: 'casual', held: null, brooch: null } },
  stats: { miniWins: 0, blasts: 0 },
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
  for (const k of ['today', 'crops', 'seeds', 'mats', 'stats', 'wardrobe']) s[k] = { ...base[k], ...s[k] };
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
