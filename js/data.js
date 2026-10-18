// Who you phone at night for deliveries. Change it here to rename the contact everywhere.
export const DELIVERY_CONTACT = 'Jeff Bezos';

export const LEVELS_PER_DAY = 3;

// Crops grow one step per night you sleep.
// yield is per plant; a planter holds one plant per level. sell = coins each in the Pantry.
export const CROPS = {
  wheat:   { name: 'Wheat',   nights: 1, yield: 3, sell: 3 },
  cotton:  { name: 'Cotton',  nights: 1, yield: 3, sell: 5 },
  flowers: { name: 'Flowers', nights: 2, yield: 3, sell: 8 },
  pumpkin: { name: 'Pumpkin', nights: 3, yield: 2, sell: 14 },
};

export const MATERIALS = { lumber: 'Lumber', fabric: 'Fabric' };

// The attic has four walls with four planter spots each.
export const WALLS = ['North', 'East', 'South', 'West'];
export const SPOTS_PER_WALL = 4;
export const SPOT_COUNT = WALLS.length * SPOTS_PER_WALL;

// Planter kit price, by how many planters you already have (kits waiting to be built count too).
export const kitPrice = owned => (owned >= SPOT_COUNT ? null : 20 + owned * 15);

// Planter levels: plants = plants per seed packet; upgrade = cost to reach this level.
export const PLANTERS = [
  null,
  { name: 'Clay pot',       plants: 1 },
  { name: 'Wooden box',     plants: 2, upgrade: { coins: 20, lumber: 2 } },
  { name: 'Raised bed',     plants: 3, upgrade: { coins: 45, lumber: 4, fabric: 1 } },
  { name: 'Greenhouse bed', plants: 4, upgrade: { coins: 90, lumber: 6, fabric: 2 }, faster: true },
];

// Crafted in the Pantry, used before a mini-game. `games` lists the mini-games (or mashups) it helps.
export const BOOSTS = {
  tea:     { name: 'Catnip Tea',    need: { flowers: 2, wheat: 1 }, effect: '+1 heart', games: ['mew', 'cw+mew', 'micro', 'micro+mew', 'micro+cw', 'micro+pegs'] },
  snack:   { name: 'Pumpkin Snack', need: { pumpkin: 1 }, effect: '+2 balls (+1 heart in Peg Rush)', games: ['pegs', 'pegs+ttt', 'mew+pegs', 'cw+pegs', 'micro+pegs'] },
  toast:   { name: 'Honey Toast',   need: { wheat: 3 }, effect: '+30s in Word Search, or a bigger letter tray in Word-Tac-Toe', games: ['cw', 'cw+ttt'] },
  scarf:   { name: 'Cozy Scarf',    need: { cotton: 3 }, effect: 'The storm gets sleepy', games: ['ttt', 'pegs+ttt', 'mew+ttt', 'cw+ttt', 'micro+ttt'] },
  jam:     { name: 'Rainbow Jam',   need: { wheat: 1, cotton: 1, flowers: 1, pumpkin: 1 }, effect: 'A second chance if you lose', games: ['*'] },
};

// What the night-time delivery service sells.
export const CATALOG = [
  { id: 'seed:wheat',   name: 'Wheat seeds',   icon: 'wheat',   price: 4,  note: 'Ready after 1 night' },
  { id: 'seed:cotton',  name: 'Cotton seeds',  icon: 'cotton',  price: 8,  note: 'Ready after 1 night' },
  { id: 'seed:flowers', name: 'Flower seeds',  icon: 'flowers', price: 12, note: 'Ready after 2 nights' },
  { id: 'seed:pumpkin', name: 'Pumpkin seeds', icon: 'pumpkin', price: 18, note: 'Ready after 3 nights' },
  { id: 'lumber',       name: 'Lumber',        icon: 'lumber',  price: 10, note: 'For furniture and frames' },
  { id: 'fabric',       name: 'Fabric',        icon: 'fabric',  price: 12, note: 'For anything soft' },
  { id: 'kit',          name: 'Planter kit',   icon: 'kit',     price: null, note: 'Build a clay pot planter in any empty spot' },
  { id: 'arcade',       name: 'Arcade cabinet', icon: 'arcade', price: 120,  note: 'Magical Mewdoku, 100 levels, right in the cabin' },
];

export const DECOR = [
  { id: 'curtains', name: 'Velvet Curtains', need: { fabric: 2, cotton: 2 }, desc: 'Keeps the draft out.' },
  { id: 'vase',     name: 'Flower Vase',     need: { lumber: 1, flowers: 3 }, desc: 'A little spring on the sill.' },
  { id: 'rug',      name: 'Braided Rug',     need: { fabric: 2, cotton: 3 }, desc: 'Warm toes, happy heart.' },
  { id: 'painting', name: 'Sunny Painting',  need: { lumber: 2, flowers: 2 }, desc: 'Proof the sun exists.' },
  { id: 'shelf',    name: 'Book Nook',       need: { lumber: 4, wheat: 3 }, desc: 'Paper-bound rainy day plans.' },
  { id: 'quilt',    name: 'Patchwork Quilt', need: { fabric: 3, cotton: 4 }, desc: 'Drape it over the armchair.' },
  { id: 'lantern',  name: 'Pumpkin Lantern', need: { pumpkin: 2 }, desc: 'A grin that glows.' },
  { id: 'fern',     name: 'Potted Fern',     need: { lumber: 1, flowers: 2, wheat: 2 }, desc: 'Loves the humidity.' },
  { id: 'lights',   name: 'String Lights',   need: { lumber: 1, fabric: 1, pumpkin: 1, flowers: 2 }, desc: 'Twinkle along the beam.' },
  { id: 'catbed',   name: 'Pet Bed',         need: { lumber: 3, fabric: 2, cotton: 3, wheat: 2 }, desc: 'Cozier than the floor by the fire.' },
];

// Magical-girl wardrobe. Bought with star shards; legendary pieces also need a milestone.
export const SLOTS = { head: 'Head', outfit: 'Outfit', held: 'In hand', brooch: 'Brooch' };
export const WARDROBE = [
  { id: 'casual',    slot: 'outfit', name: 'Cozy Sweater',            rarity: 'common',    cost: 0,  perk: 'Comfy. No powers.' },
  { id: 'bow',       slot: 'head',   name: 'Ribbon Bow',              rarity: 'common',    cost: 2,  perk: '+5 coins for every level won' },
  { id: 'sailor',    slot: 'outfit', name: 'Magical Uniform',         rarity: 'rare',      cost: 5,  perk: '+2 moves every level' },
  { id: 'tiara',     slot: 'head',   name: 'Crescent Tiara',          rarity: 'rare',      cost: 6,  perk: '+10% points' },
  { id: 'heart',     slot: 'brooch', name: 'Heart Brooch',            rarity: 'rare',      cost: 6,  perk: 'Mini-games are a little easier' },
  { id: 'wand',      slot: 'held',   name: 'Star Wand',               rarity: 'rare',      cost: 8,  perk: 'Hints find your biggest match, sooner' },
  { id: 'ringtiara', slot: 'head',   name: 'Saturn Ring Tiara',       rarity: 'legendary', cost: 12, unlock: { miniWins: 10 },  perk: 'Every blast reaches further' },
  { id: 'violet',    slot: 'outfit', name: 'Saturn Guardian Uniform', rarity: 'legendary', cost: 15, unlock: { day: 7 },        perk: '+3 moves, and tic-tac-toe ties count as wins' },
  { id: 'crystal',   slot: 'brooch', name: 'Saturn Crystal',          rarity: 'legendary', cost: 15, unlock: { threeStars: 5 }, perk: 'Lose a mini-game? Retry it, once per level' },
  { id: 'glaive',    slot: 'held',   name: 'Saturn Glaive',           rarity: 'legendary', cost: 20, unlock: { blasts: 20 },    perk: 'Once per level, a charged tile blasts with no mini-game' },
];
export const SATURN_SET = ['ringtiara', 'violet', 'crystal', 'glaive'];

// What each level introduces. The game starts small and builds up.
export const UNLOCKS = {
  1: { kind: 'ttt' },
  3: { kind: 'mew' },
  4: { kind: 'cw' },
  5: { kind: 'pegs' },
  6: { mashups: true },
  7: { kind: 'micro' }, // the Dang! tile: chain reactions leave one behind
};
const BOARD_SIZES = [[6, 6], [6, 7], [7, 7], [7, 8]]; // then 7x9 from level 5

export function levelConfig(n) {
  const kinds = Object.entries(UNLOCKS).filter(([lv, u]) => +lv <= n && u.kind).map(([, u]) => u.kind);
  const size = BOARD_SIZES[n - 1] || [7, 9];
  return {
    n,
    size,
    kinds,
    mashups: n >= 6,
    types: n <= 2 ? 4 : n <= 7 ? 5 : 6,
    moves: n <= 2 ? 18 : Math.min(30, 20 + Math.floor(n / 3)),
    // Tuned with a bot: plain matching gets you about half to three-quarters of the way,
    // blasts make up the rest.
    target: [900, 1200, 1000, 1100, 1400][n - 1] || 1400 + (n - 5) * 200,
    blasts: n === 1 ? 0 : n <= 4 ? 1 : n <= 9 ? 2 : 3,
    // 0..1, how hard the big-match mini-games are.
    difficulty: Math.min(1, (n - 1) / 12),
  };
}
