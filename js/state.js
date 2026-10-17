const KEY = 'dang-cabin-v1';

const fresh = () => ({
  coins: 0,
  maxLevel: 1,
  stars: {},
  supplies: { wheat: 0, cotton: 0, flowers: 0, pumpkin: 0 },
  decor: {},
  plots: Array.from({ length: 6 }, () => ({ crop: null, planted: 0 })),
  plotsOwned: 1,
  farmUnlocked: false,
  seen: {},
  sound: true,
});

function load() {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...base, ...saved, supplies: { ...base.supplies, ...saved.supplies } };
    }
  } catch {}
  return base;
}

export const S = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
}
