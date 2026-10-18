import { buildSearch, DIRS_EASY, DIRS_MEDIUM, DIRS_HARD } from '../minigames/wordsearch.js';

// The Word Search cartridge: 100 levels, a new theme every 20.
// Grids grow from 8x8 to 12x12, word lists from 6 to 12, and words start running backwards
// (from level 26) and in every direction (from level 51). Levels are seeded, so everyone gets
// the same puzzles and leaderboard times compare fairly.
export const LEVEL_COUNT = 100;

export const THEMES = [
  {
    name: 'Rainy Cabin', color: '#9fd3f2',
    words: ['RAIN', 'CABIN', 'QUILT', 'KETTLE', 'CANDLE', 'FIRE', 'MUG', 'BOOKS', 'SLIPPER', 'COCOA', 'BLANKET', 'WINDOW', 'PORCH', 'CHIMNEY',
      'LANTERN', 'RUG', 'SWEATER', 'SOCKS', 'TEAPOT', 'PILLOW', 'LOGS', 'EMBER', 'ROOF', 'ATTIC', 'PUDDLE', 'BOOTS', 'UMBRELLA', 'THUNDER',
      'CLOUD', 'DRIZZLE', 'STOVE', 'BISCUIT', 'OVEN', 'PANTRY', 'HONEY', 'ARMCHAIR', 'CURTAIN', 'CLOCK', 'PUZZLE', 'YARN', 'NAP', 'SNUG', 'COZY'],
  },
  {
    name: 'Magical Girls', color: '#f08ab0',
    words: ['WAND', 'TIARA', 'MOON', 'STAR', 'BROOCH', 'SATURN', 'GLAIVE', 'SPELL', 'RIBBON', 'SPARKLE', 'CRYSTAL', 'LOCKET', 'SCEPTER', 'PRISM',
      'COMPACT', 'TRANSFORM', 'GUARDIAN', 'SAILOR', 'PLANET', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'NEPTUNE', 'URANUS', 'PLUTO', 'ORBIT',
      'HALO', 'CHARM', 'POTION', 'FAIRY', 'MAGIC', 'HEART', 'COSMIC', 'ETERNAL', 'SHIELD', 'SILVER', 'CRESCENT', 'DESTINY', 'DREAMER'],
  },
  {
    name: 'Swiftie Eras', color: '#d8c4f0',
    words: ['FEARLESS', 'RED', 'LOVER', 'FOLKLORE', 'EVERMORE', 'MIDNIGHTS', 'REPUTATION', 'ENCHANTED', 'CARDIGAN', 'WILLOW', 'AUGUST', 'BETTY',
      'EXILE', 'KARMA', 'ANTIHERO', 'MASTERMIND', 'BEJEWELED', 'MAROON', 'DELICATE', 'GORGEOUS', 'STYLE', 'CLEAN', 'MINE', 'OURS', 'FIFTEEN',
      'DAYLIGHT', 'PARIS', 'MIRRORBALL', 'SEVEN', 'MARJORIE', 'CLOSURE', 'DOROTHEA', 'FORTNIGHT', 'ERAS', 'SWIFTIE', 'GUITAR', 'SEQUINS',
      'BRACELET', 'THIRTEEN', 'MEREDITH', 'OLIVIA', 'BENJAMIN', 'LAVENDER', 'CRUEL', 'SUMMER', 'TOUR'],
  },
  {
    name: 'Attic Garden', color: '#c8ecb0',
    words: ['SEED', 'WHEAT', 'PUMPKIN', 'COTTON', 'HOE', 'SPROUT', 'BLOOM', 'HARVEST', 'SOIL', 'WATER', 'TULIP', 'DAISY', 'ROSE', 'CARROT',
      'TOMATO', 'BEAN', 'PEA', 'ONION', 'CLOVER', 'BEE', 'WORM', 'SNAIL', 'FENCE', 'SHOVEL', 'RAKE', 'BASKET', 'BARN', 'HAY', 'ORCHARD',
      'APPLE', 'PEAR', 'BERRY', 'VINE', 'LEAF', 'ROOT', 'STEM', 'PETAL', 'POLLEN', 'GREENHOUSE', 'COMPOST', 'SUNFLOWER', 'LADYBUG'],
  },
  {
    name: 'Starry Night', color: '#ffe27a',
    words: ['COMET', 'NEBULA', 'GALAXY', 'METEOR', 'ECLIPSE', 'AURORA', 'TELESCOPE', 'ASTEROID', 'COSMOS', 'STARDUST', 'ZENITH', 'LUNAR',
      'SOLAR', 'ROCKET', 'ALIEN', 'CRATER', 'DUSK', 'DAWN', 'TWILIGHT', 'OWL', 'FIREFLY', 'CRICKET', 'LULLABY', 'PAJAMAS', 'MOONBEAM',
      'STARLIGHT', 'WISH', 'DREAMS', 'SLEEPY', 'NIGHTLIGHT', 'GLOWWORM', 'POLARIS', 'ORION', 'BIGDIPPER', 'SATELLITE', 'MILKYWAY'],
  },
];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Level n (1..100): { n, theme, color, size, grid, placed, par } where par is the 3-star time.
export function levelData(n) {
  const theme = THEMES[Math.floor((n - 1) / 20)];
  const size = Math.min(12, 8 + Math.floor((n - 1) / 25) + ((n - 1) % 20 >= 10 ? 1 : 0));
  const count = Math.min(12, 6 + Math.floor((n - 1) / 12));
  const dirs = n <= 25 ? DIRS_EASY : n <= 50 ? DIRS_MEDIUM : DIRS_HARD;
  const R = rng(n * 104729 + 7);
  for (let attempt = 0; attempt < 50; attempt++) {
    const pool = theme.words.filter(w => w.length <= size);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const built = buildSearch(size, pool.slice(0, count), dirs, R);
    if (built) return { n, theme: theme.name, color: theme.color, size, ...built, par: count * 8, ok: count * 14 };
  }
  throw new Error('could not build word search level ' + n);
}
