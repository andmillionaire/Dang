import { S, persist } from './state.js';
import { openVN } from './vn.js';
import { RainWindow } from './rainview.js';
import { PETS } from './sprites.js';
import { drawHero } from './hero.js';
import { sleep } from './pixel.js';

const SW = 96, SH = 72;
const DOOR = { x: 34, y: 12, w: 28, h: 48 };

export const petSound = () => (S.pet && S.pet.kind === 'dog' ? 'woof' : 'meow');

// A curled-up, sleeping pet with a slow breath and drifting z's. (x, y) is the sprite's top-left.
export function drawSleepingPet(ctx, x, y, now) {
  if (!S.pet) return;
  const img = S.pet.kind === 'dog' ? PETS.dogSleep : PETS.catSleep;
  ctx.fillStyle = 'rgba(20,10,10,0.3)';
  ctx.fillRect(x + 1, y + img.height - 1, img.width - 2, 2);
  const breath = Math.floor(now / 1100) % 2;
  ctx.drawImage(img, x, y + breath);
  const z = (now / 1600) % 1;
  ctx.globalAlpha = 1 - z;
  ctx.fillStyle = '#efdcb4';
  const zx = x + 12 + Math.round(z * 5), zy = y - 3 - Math.round(z * 9);
  ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
  ctx.globalAlpha = 1;
}

function drawDoorScene(ctx, now, st, rain) {
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  for (let x = 0, i = 0; x < SW; x += 8, i++) { R(i % 2 ? '#5c3a26' : '#553422', x, 0, 8, 60); R('#432819', x, 0, 1, 60); }
  for (let y = 60, i = 0; y < SH; y += 6, i++) { R(i % 2 ? '#7a4a2c' : '#714428', 0, y, SW, 6); R('#4e2e1c', 0, y, SW, 1); }
  R('#3a2216', 0, 58, SW, 2);

  R('#3b2418', DOOR.x - 3, DOOR.y - 3, DOOR.w + 6, DOOR.h + 3);
  if (!st.open) {
    const shake = now < st.scratchUntil ? Math.round(Math.sin(now / 30)) : 0;
    const dx = DOOR.x + shake;
    R('#7a4a2c', dx, DOOR.y, DOOR.w, DOOR.h);
    R('#6b3d22', dx + 3, DOOR.y + 4, DOOR.w - 6, 17); R('#6b3d22', dx + 3, DOOR.y + 26, DOOR.w - 6, 18);
    R('#8a5a34', dx + 3, DOOR.y + 4, DOOR.w - 6, 1); R('#8a5a34', dx + 3, DOOR.y + 26, DOOR.w - 6, 1);
    R('#f2c84b', dx + DOOR.w - 6, DOOR.y + 24, 2, 2);
    if (now < st.scratchUntil) {
      R('#e8c8a0', dx + 9, DOOR.y + DOOR.h - 6, 1, 4); R('#e8c8a0', dx + 12, DOOR.y + DOOR.h - 7, 1, 5); R('#e8c8a0', dx + 15, DOOR.y + DOOR.h - 6, 1, 4);
    }
    // light under the door
    R('rgba(150,180,230,0.25)', DOOR.x, DOOR.y + DOOR.h - 1, DOOR.w, 1);
  } else {
    rain.update(now);
    rain.draw(ctx, DOOR.x, DOOR.y, now);
    R('#7a4a2c', DOOR.x - 6, DOOR.y + 2, 5, DOOR.h - 2); R('#5a3622', DOOR.x - 2, DOOR.y + 2, 1, DOOR.h - 2);
    R('rgba(140,170,230,0.12)', DOOR.x - 4, 60, DOOR.w + 12, 12);
    if (st.pet) {
      const img = st.pet === 'dog' ? PETS.dogSit : PETS.catSit;
      const wag = st.pet === 'dog' && Math.floor(now / 160) % 2 ? 1 : 0;
      ctx.drawImage(img, DOOR.x + 6 + wag, DOOR.y + DOOR.h - 16 + 1);
      if (now < st.dripUntil) {
        R('#9fd3f2', DOOR.x + 8 + ((now / 40) % 12 | 0), DOOR.y + DOOR.h - 6 + ((now / 25) % 6 | 0), 1, 1);
        R('#9fd3f2', DOOR.x + 18 - ((now / 55) % 10 | 0), DOOR.y + DOOR.h - 10 + ((now / 30) % 9 | 0), 1, 1);
      }
    }
  }

  drawHero(ctx, 8, 60 - 27 + 1, { now, magic: false });
  const g = ctx.createRadialGradient(10, 40, 4, 10, 40, 70);
  g.addColorStop(0, 'rgba(255,170,80,0.18)'); g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
}

const NAMES = { dog: ['Biscuit', 'Sunny', 'Maple', 'Honey', 'Waffles'], cat: ['Luna', 'Pepper', 'Mochi', 'Midnight', 'Inkwell'] };

// Night 2: something scratches at the door.
export async function petArrives({ sfx }) {
  const kind = Math.random() < 0.5 ? 'dog' : 'cat';
  const me = S.hero.name;
  const st = { open: false, pet: null, scratchUntil: 0, dripUntil: 0 };
  const rain = new RainWindow(DOOR.w, DOOR.h);
  const v = openVN({ drawScene: (ctx, now) => drawDoorScene(ctx, now, st, rain), w: SW, h: SH, sfx });
  const scratch = async () => { st.scratchUntil = performance.now() + 900; sfx('scratch'); await sleep(950); };
  const dog = kind === 'dog';

  await scratch();
  await v.say('', '*scratch, scratch, scratch*');
  await v.say(me, 'Huh? Something’s scratching at the door…');
  const pick = await v.choose(me, 'At this hour? In this rain?', ['Open the door', 'Pretend you didn’t hear it']);
  if (pick === 1) {
    await scratch();
    await v.say('', '*scratch scratch*… and then a tiny, soggy whimper.');
    await v.choose(me, 'Okay, okay. I can’t ignore that.', ['Open the door']);
  }

  sfx('door');
  st.open = true;
  await sleep(600);
  st.pet = kind;
  st.dripUntil = performance.now() + 4000;
  sfx(dog ? 'woof' : 'meow');
  if (dog) {
    await v.say('', 'A soaking-wet golden retriever is sitting on the step. Its whole body wiggles when it wags.');
    await v.say(me, 'Oh! Hello there, you poor drowned thing!');
    await v.say('', 'It shakes itself off. Thoroughly. Now you’re wet too.');
  } else {
    await v.say('', 'A small black cat slips past your ankles before you can say a word.');
    await v.say('', 'It shakes the rain off each paw, one at a time, then stares up at you like it has always lived here.');
    await v.say(me, 'Well. Hello to you too.');
  }

  const stay = await v.choose(me, 'Do you want to stay here with me?', [dog ? 'Of course you can stay!' : 'You can stay. Obviously.', 'Fetch a towel first']);
  if (stay === 1) {
    st.dripUntil = 0;
    await v.say('', dog ? 'You towel them dry. Their tail never stops wagging.' : 'You towel them dry. They tolerate it. Barely.');
  }

  const name = await v.ask(me, dog ? 'Every good dog needs a name…' : 'Every cat needs a name. Not that they’ll answer to it…',
    { suggestions: NAMES[kind], placeholder: dog ? 'Dog’s name' : 'Cat’s name' });
  S.pet = { kind, name: name.slice(0, 12) };
  persist();
  sfx(dog ? 'woof' : 'meow');
  await v.say(S.pet.name, dog ? 'Woof!' : 'Mrrp.');
  await v.say('', `${S.pet.name} pads over to the fireplace, curls up in the warm spot and falls asleep almost instantly.`);
  await v.say(me, 'Welcome home.');
  v.close();
}
