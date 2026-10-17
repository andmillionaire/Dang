// Tiny WebAudio synth: rain ambience plus chiptune-ish effects. No audio files needed.
let ac, master, enabled = true;

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05);
}

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = enabled ? 1 : 0;
  master.connect(ac.destination);
  startRain();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ac.suspend(); else ac.resume();
  });
}

function noiseBuffer(seconds, brown) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
    else d[i] = white;
  }
  return buf;
}

function startRain() {
  const body = ac.createBufferSource();
  body.buffer = noiseBuffer(3, true);
  body.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1100;
  const g1 = ac.createGain(); g1.gain.value = 0.22;
  body.connect(lp).connect(g1).connect(master);
  body.start();

  const patter = ac.createBufferSource();
  patter.buffer = noiseBuffer(2, false);
  patter.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.6;
  const g2 = ac.createGain(); g2.gain.value = 0.025;
  patter.connect(bp).connect(g2).connect(master);
  patter.start();
}

function tone(freq, dur, { type = 'square', vol = 0.06, slide, delay = 0 } = {}) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function burst(dur, { vol = 0.3, freq = 400, delay = 0 } = {}) {
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05, false);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(60, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319];

export function sfx(name, arg = 1) {
  if (!ac || !enabled) return;
  switch (name) {
    case 'swap': tone(440, 0.06, { vol: 0.03, slide: 520 }); break;
    case 'nope': tone(200, 0.12, { vol: 0.05, slide: 140 }); break;
    case 'select': tone(660, 0.04, { vol: 0.025, type: 'triangle' }); break;
    case 'pop': tone(NOTES[Math.min(arg - 1, 7)], 0.09, { vol: 0.05, type: 'triangle' }); break;
    case 'land': tone(120, 0.05, { vol: 0.03, type: 'sine' }); break;
    case 'charge': tone(200, 0.6, { vol: 0.05, slide: 900, type: 'sawtooth' }); break;
    case 'boom': burst(1.2, { vol: 0.6, freq: 900 }); tone(90, 0.6, { vol: 0.12, type: 'sine', slide: 40 }); break;
    case 'fizzle': burst(0.5, { vol: 0.15, freq: 3000 }); tone(300, 0.4, { vol: 0.04, slide: 80 }); break;
    case 'place': tone(784, 0.08, { vol: 0.05, type: 'triangle' }); break;
    case 'aiplace': tone(330, 0.1, { vol: 0.05, type: 'triangle' }); break;
    case 'tttwin': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, { vol: 0.05, delay: i * 0.09 })); break;
    case 'tttlose': [392, 330, 262].forEach((f, i) => tone(f, 0.2, { vol: 0.05, delay: i * 0.12, type: 'triangle' })); break;
    case 'win': [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { vol: 0.05, delay: i * 0.11 })); break;
    case 'lose': [440, 415, 392, 330].forEach((f, i) => tone(f, 0.25, { vol: 0.045, delay: i * 0.18, type: 'triangle' })); break;
    case 'coin': tone(988, 0.06, { vol: 0.04 }); tone(1319, 0.12, { vol: 0.04, delay: 0.06 }); break;
    case 'plant': tone(300, 0.08, { vol: 0.05, type: 'triangle', slide: 450 }); break;
    case 'harvest': [659, 880, 1175].forEach((f, i) => tone(f, 0.08, { vol: 0.04, delay: i * 0.05, type: 'triangle' })); break;
    case 'purr': for (let i = 0; i < 6; i++) tone(55, 0.09, { vol: 0.08, type: 'sawtooth', delay: i * 0.11 }); break;
    case 'thunder': burst(2.2, { vol: 0.35, freq: 220 }); break;
    case 'alarm': [1568, 1568, 1568].forEach((f, i) => tone(f, 0.05, { vol: 0.04, delay: i * 0.08 })); break;
    case 'sparkle': [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => tone(f, 0.25, { vol: 0.035, delay: i * 0.07, type: 'triangle' })); break;
    case 'morph': tone(300, 0.5, { vol: 0.05, slide: 1400, type: 'triangle' }); tone(450, 0.5, { vol: 0.03, slide: 2000, delay: 0.05 }); break;
    case 'morphBack': tone(1400, 0.4, { vol: 0.04, slide: 300, type: 'triangle' }); break;
    case 'peg': tone(NOTES[Math.min(arg - 1, 7)] / 2 * (1 + Math.floor((arg - 1) / 8)), 0.07, { vol: 0.045, type: 'triangle' }); break;
    case 'mew': tone(900, 0.18, { vol: 0.04, slide: 600, type: 'triangle' }); tone(700, 0.12, { vol: 0.03, slide: 1000, delay: 0.1, type: 'sine' }); break;
    case 'type': tone(1200 + Math.random() * 200, 0.025, { vol: 0.02 }); break;
    case 'ring': [0, 0.12, 0.6, 0.72].forEach(d => tone(880, 0.1, { vol: 0.035, delay: d, type: 'sine' })); break;
    case 'doorbell': tone(784, 0.5, { vol: 0.05, type: 'sine' }); tone(622, 0.7, { vol: 0.05, type: 'sine', delay: 0.4 }); break;
    case 'glaive': burst(0.4, { vol: 0.2, freq: 5000 }); tone(220, 0.6, { vol: 0.06, slide: 880, type: 'sawtooth' }); break;
    case 'drip': tone(1400 + Math.random() * 400, 0.05, { vol: 0.015, type: 'sine', slide: 700 }); break;
  }
}
