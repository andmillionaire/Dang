export const CROPS = {
  wheat:   { name: 'Wheat',   cost: 5,  time: 30,  yield: 3 },
  cotton:  { name: 'Cotton',  cost: 10, time: 60,  yield: 3 },
  flowers: { name: 'Flowers', cost: 15, time: 120, yield: 3 },
  pumpkin: { name: 'Pumpkin', cost: 25, time: 180, yield: 2 },
};

export const PLOT_COSTS = [0, 40, 75, 120, 180, 250];

export const DECOR = [
  { id: 'curtains', name: 'Velvet Curtains', coins: 20, need: { cotton: 3 }, desc: 'Keeps the draft out.' },
  { id: 'vase',     name: 'Flower Vase',     coins: 15, need: { flowers: 2 }, desc: 'A little spring on the sill.' },
  { id: 'rug',      name: 'Braided Rug',     coins: 30, need: { cotton: 4, wheat: 2 }, desc: 'Warm toes, happy heart.' },
  { id: 'painting', name: 'Sunny Painting',  coins: 35, need: { flowers: 3 }, desc: 'Proof the sun exists.' },
  { id: 'shelf',    name: 'Book Nook',       coins: 40, need: { wheat: 5 }, desc: 'Paper-bound rainy day plans.' },
  { id: 'quilt',    name: 'Patchwork Quilt', coins: 45, need: { cotton: 6 }, desc: 'Drape it over the armchair.' },
  { id: 'lantern',  name: 'Pumpkin Lantern', coins: 35, need: { pumpkin: 2 }, desc: 'A grin that glows.' },
  { id: 'fern',     name: 'Potted Fern',     coins: 30, need: { flowers: 2, wheat: 3 }, desc: 'Loves the humidity.' },
  { id: 'lights',   name: 'String Lights',   coins: 60, need: { pumpkin: 2, flowers: 3 }, desc: 'Twinkle along the beam.' },
  { id: 'catbed',   name: 'Cat Bed',         coins: 80, need: { cotton: 5, wheat: 4 }, desc: 'Build it and a cat will come.' },
];

export function levelConfig(n) {
  return {
    n,
    types: n <= 6 ? 5 : 6,
    moves: Math.min(30, 20 + Math.floor(n / 3)),
    target: 1000 + (n - 1) * 250,
    blasts: n <= 3 ? 1 : n <= 8 ? 2 : 3,
    // Chance the storm plays a perfect tic-tac-toe move.
    aiSkill: Math.min(0.85, 0.35 + n * 0.05),
  };
}
