// Layered 16x27 pixel character. Each layer is { y, rows } (16 wide, '.' transparent).
// Placeholders: k outline, 1 skin, 2 freckle, 3 hair, 4 hair highlight, 5 eyes, w white,
// f blush, r tongue, y gold, 7 top, 8 collar, 9 bow/accent, 0 bottoms, 6 legs, z shoes, A/a hat.

const rep = (row, n) => Array.from({ length: n }, () => row);

export const HEAD = { y: 2, rows: [
  '....kkkkkkkk....',
  '...k11111111k...',
  '..k1111111111k..',
  '..k1111111111k..',
  '.k111111111111k.',
  '.k111111111111k.',
  '.k111111111111k.',
  '..k1111111111k..',
  '...k11111111k...',
  '....kk1111kk....',
] };

export const TORSO = { y: 12, rows: [
  '...k87711778k...',
  '..kk88799788kk..',
  '..k7777997777k..',
  '..k7k777777k7k..',
  '..k1k777777k1k..',
] };

export const BOTTOMS = {
  skirt: { y: 17, rows: [
    '...k00000000k...',
    '..k0000000000k..',
    '.k000000000000k.',
    '.kkkkkkkkkkkkkk.',
    '....k66kk66k....',
    '....k66kk66k....',
    '....k66kk66k....',
  ] },
  shorts: { y: 17, rows: [
    '...k00000000k...',
    '...k00000000k...',
    '...k000kk000k...',
    '...kkkk..kkkk...',
    '....k11kk11k....',
    '....k11kk11k....',
    '....k11kk11k....',
  ] },
  pants: { y: 17, rows: [
    '...k00000000k...',
    '...k00000000k...',
    '...k000kk000k...',
    '...k000kk000k...',
    '....k00kk00k....',
    '....k00kk00k....',
    '....k00kk00k....',
  ] },
};

export const SHOES = { y: 24, rows: [
  '....kzzkkzzk....',
  '...kzzzkkzzzk...',
  '...kkkk..kkkk...',
] };

export const EYES = {
  round:   { y: 5, rows: ['................', '....55....55....', '....5w....w5....'] },
  sparkly: { y: 5, rows: ['....55....55....', '....5w....w5....', '....55....55....'] },
  sleepy:  { y: 5, rows: ['................', '....kk....kk....', '....55....55....'] },
  closed:  { y: 5, rows: ['................', '................', '....kk....kk....'] },
};
export const LASHES = { y: 5, rows: ['...k........k...'] };

export const MOUTHS = {
  smile: { y: 9, rows: ['......k..k......', '.......kk.......'] },
  grin:  { y: 9, rows: ['......kkkk......', '.......rr.......'] },
  calm:  { y: 9, rows: ['................', '.......kk.......'] },
  cat:   { y: 9, rows: ['......k.k.k.....', '.......k.k......'] },
};

export const CHEEKS = {
  none: { y: 8, rows: ['................'] },
  blush: { y: 8, rows: ['...ff......ff...'] },
  freckles: { y: 8, rows: ['...2.2....2.2...'] },
};

const LONG_FRONT_TOP = [
  '.....kkkkkk.....',
  '...kk334433kk...',
  '..k3334444333k..',
  '.k333333333333k.',
  '.k33.33.33.333k.',
];

export const HAIR = {
  long: {
    back: { y: 3, rows: ['..k3333333333k..', ...rep('.k333333333333k.', 14), '..kk33333333kk..'] },
    front: { y: 0, rows: [...LONG_FRONT_TOP,
      '.k3..........3k.',
      'k33..........33k',
      'k33..........33k',
      'k33..........33k',
      '.k3..........3k.',
      '.k33........33k.',
      '..k3........3k..',
    ] },
  },
  bob: {
    back: { y: 3, rows: ['..k3333333333k..', ...rep('.k333333333333k.', 8), '..kk33333333kk..'] },
    front: { y: 0, rows: [...LONG_FRONT_TOP,
      '.k3..........3k.',
      '.k3..........3k.',
      '.k3..........3k.',
      '.k33........33k.',
      '.k33........33k.',
      '.k33........33k.',
      '..kk........kk..',
    ] },
  },
  twintails: {
    back: { y: 4, rows: ['k4............4k', ...rep('33............33', 12), '.3............3.'] },
    front: { y: 0, rows: [...LONG_FRONT_TOP,
      '.k3..........3k.',
      '.k3..........3k.',
      '.k3..........3k.',
    ] },
  },
  ponytail: {
    back: { y: 1, rows: [
      '............kk..',
      '...........k33k.',
      '..k33333333k343k',
      '.k333333333k333k',
      '.k3333333333k33k',
      '.k3333333333k33k',
      '.k3333333333k33k',
      '.k333333333k33k.',
      '...........k33k.',
      '..........k33k..',
      '..........kk....',
    ] },
    front: { y: 0, rows: [...LONG_FRONT_TOP, '.k3..........3k.', '.k3..........3k.'] },
  },
  short: {
    back: { y: 2, rows: ['...k33333333k...', ...rep('.k333333333333k.', 6)] },
    front: { y: 0, rows: [...LONG_FRONT_TOP, '.k3..........3k.', '.k3..........3k.'] },
  },
  fluffy: {
    back: { y: 3, rows: [...rep('k33333333333333k', 8), '.kk3k33333k3kk..'] },
    front: { y: 0, rows: [
      '....k.kkkk.k....',
      '...k3k3333k3k...',
      '..k3334444333k..',
      '.k333433334333k.',
      'k33333333333333k',
      'k33.333..333.33k',
      'k3............3k',
      'k33..........33k',
      'k3............3k',
      '.k3..........3k.',
    ] },
  },
};

export const ACCS = {
  none: null,
  glasses: { y: 5, rows: ['...kkkk..kkkk...', '...k..k..k..k...', '...k..kkkk..k...', '...kkkk..kkkk...'] },
  flower: { y: 1, rows: ['...........f.f..', '............y...', '...........f.f..'] },
  beanie: { y: 0, rows: ['.....kkkkkk.....', '...kkAAAAAAkk...', '..kAAAAAAAAAAk..', '.kaaaaaaaaaaaak.'] },
  star: { y: 2, rows: ['...y............', '..yyy...........', '...y............'] },
};

// Colour choices.
export const SKINS = [['#fde3cf', '#d9a080'], ['#f7d4b8', '#c98a60'], ['#e8b48c', '#a8683e'], ['#c98a5e', '#8a5230'], ['#9a6240', '#5e3820'], ['#6b4228', '#3e2414']];
export const HAIR_COLORS = [
  ['Chestnut', '#6b3a2e', '#9a5640'], ['Ink', '#1e1a2a', '#3e3650'], ['Honey', '#d8a840', '#f8d888'],
  ['Ginger', '#c0582a', '#e8843e'], ['Bubblegum', '#e87ab0', '#f8b0d4'], ['Lavender', '#9a7ad0', '#c8b0f4'],
  ['Ocean', '#3a5aa0', '#6a8ad8'], ['Silver', '#a8a8bc', '#e0e0ee'], ['Mint', '#4aa890', '#88dcc4'], ['Plum', '#5a2a4a', '#8a4a70'],
];
export const EYE_COLORS = [['Cocoa', '#5a3a2a'], ['Sky', '#3a6ad0'], ['Fern', '#3a8a4a'], ['Violet', '#6a3aa0'], ['Amber', '#c08020'], ['Storm', '#5a6070'], ['Rose', '#c04a8a']];
export const TOPS = [
  ['Cream', '#efdcb4', '#c9ad7f', '#d0463c'], ['Berry', '#c0405a', '#8a2a40', '#ffe27a'], ['Mint', '#8fd0b0', '#5a9a80', '#f08ab0'],
  ['Sky', '#8ab8e8', '#5a88c0', '#fff4e0'], ['Lilac', '#c0a0e0', '#8a6ab0', '#ffe27a'], ['Mustard', '#e0b040', '#a87a20', '#6b3d22'],
  ['Forest', '#3d7a34', '#285024', '#efdcb4'], ['Charcoal', '#4a4458', '#2e2a38', '#f08ab0'],
];
export const BOTTOM_COLORS = [['Denim', '#4f8fd0'], ['Navy', '#2c3a6a'], ['Cherry', '#a03a3a'], ['Cocoa', '#6b4a30'], ['Black', '#2a2430'], ['Pink', '#e08ab0'], ['Moss', '#3d7a34']];
export const SHOE_COLORS = [['Brown', '#6b3d22'], ['Red', '#d0463c'], ['Black', '#2a2430'], ['White', '#efe6f0'], ['Pink', '#e08ab0'], ['Purple', '#6a3e94']];

// Wardrobe outfits override the clothes colours but keep the body, face, hair and bottoms style.
export const OUTFITS = {
  pajamas: { top: '#9fd3f2', collar: '#cfe8f8', bow: '#fff4e0', bottom: '#9fd3f2', legs: '#9fd3f2', shoes: '#f08ab0', bottomShape: 'pants' },
  sailor: { top: '#fff4e0', collar: '#4f8fd0', bow: '#d0463c', bottom: '#4f8fd0', shoes: '#d0463c' },
  violet: { top: '#efe6f6', collar: '#4a2468', bow: '#a46ad0', bottom: '#4a2468', legs: '#2e1a40', shoes: '#4a2468' },
};
