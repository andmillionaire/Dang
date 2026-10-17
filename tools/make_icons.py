#!/usr/bin/env python3
"""Generate the app icons (magical girl + "DANG") as PNGs, with no dependencies.

Usage: python3 tools/make_icons.py   (writes into icons/)
"""
import os, struct, zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
G = 32  # icon is drawn on a 32x32 pixel grid, then scaled up

PAL = {
    'k': (0x1a, 0x12, 0x20), 'H': (0xf0, 0x8a, 0xb0), 'G': (0xff, 0xc8, 0xdc), 's': (0xfd, 0xe3, 0xcf),
    'E': (0x6a, 0x3a, 0xa0), 'e': (0xa4, 0x6a, 0xd0), 'w': (0xff, 0xff, 0xff), 'r': (0xff, 0x9a, 0xa8),
    'm': (0xd0, 0x46, 0x3c), 'y': (0xff, 0xe2, 0x7a), 'X': (0xa4, 0x6a, 0xd0), 'c': (0xff, 0xf4, 0xe0),
    'u': (0x4f, 0x8f, 0xd0), 'b': (0xd0, 0x46, 0x3c),
}

GIRL = [  # 20x20
    '......kkkkkkkk......',
    '....kkHHHHHHHHkk....',
    '...kHHGGHHHHHHHHk...',
    '..kHHGHHyyXXyyHHHk..',
    '..kHHHHyyyyyyyyHHk..',
    '.kHHHHHHHHHHHHHHHHk.',
    '.kHHHsHHHsHHHsHHHHk.',
    '.kHHssssssssssssHHk.',
    'kHHssssssssssssssHHk',
    'kHHsEEEssssssEEEsHHk',
    'kHHsEwEssssssEwEsHHk',
    'kHHseEessssssEeEsHHk',
    'kHHsrrssssssssrrsHHk',
    'kHHssssssmmssssssHHk',
    'kHHHssssssssssssHHHk',
    'kHHHHksssssssskHHHHk',
    'kHHHHHkksssskkHHHHHk',
    'kHHHkcuuuccuuuckHHHk',
    'kHHkcccuubbuuccckHHk',
    'kkkkccccbbbbcccckkkk',
]

FONT = {  # 4x5
    'D': ['XXX.', 'X..X', 'X..X', 'X..X', 'XXX.'],
    'A': ['.XX.', 'X..X', 'XXXX', 'X..X', 'X..X'],
    'N': ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
    'G': ['.XXX', 'X...', 'X.XX', 'X..X', '.XXX'],
}


def art():
    assert all(len(r) == 20 for r in GIRL) and len(GIRL) == 20
    px = [[None] * G for _ in range(G)]
    # night sky with a little rain and a few stars
    for y in range(G):
        t = y / (G - 1)
        base = tuple(int(a + (b - a) * t) for a, b in zip((0x2a, 0x18, 0x40), (0x14, 0x1c, 0x34)))
        for x in range(G):
            px[y][x] = base
    for x, y in [(3, 4), (28, 6), (5, 17), (27, 15), (2, 27), (29, 25)]:
        px[y][x] = (0xff, 0xe2, 0x7a)
    for x, y0 in [(1, 1), (4, 9), (26, 2), (30, 11), (24, 19), (7, 21)]:
        for k in range(3):
            if y0 + k < G:
                px[y0 + k][x] = (0x6f, 0x8f, 0xbf)
    # the girl, centred near the top
    for j, row in enumerate(GIRL):
        for i, ch in enumerate(row):
            if ch != '.':
                px[1 + j][6 + i] = PAL[ch]
    # "DANG" in gold with a dark outline
    word, x0, y0 = 'DANG', 7, 25
    lit = set()
    for n, ch in enumerate(word):
        for j, row in enumerate(FONT[ch]):
            for i, c in enumerate(row):
                if c == 'X':
                    lit.add((x0 + n * 5 + i, y0 + j))
    for (x, y) in lit:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if 0 <= x + dx < G and 0 <= y + dy < G and (x + dx, y + dy) not in lit:
                    px[y + dy][x + dx] = PAL['k']
    for (x, y) in lit:
        px[y][x] = PAL['y']
    return px


def png(name, size, pad=0):
    px = art()
    inner = size - 2 * pad
    s = inner / G
    bg = px[G - 1][0]
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            ix, iy = x - pad, y - pad
            row += bytes(px[int(iy / s)][int(ix / s)] if 0 <= ix < inner and 0 <= iy < inner else bg)
        rows.append(bytes(row))

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(data)


if __name__ == '__main__':
    png('icon-192.png', 192)
    png('icon-512.png', 512)
    png('icon-maskable-512.png', 512, pad=64)  # content inside the maskable safe zone
    png('apple-touch-icon.png', 180, pad=10)
    print('icons written to', os.path.normpath(OUT))
