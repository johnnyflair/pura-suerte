/**
 * Sonidos generados con Web Audio (sin archivos ni licencias).
 * El navegador solo deja sonar audio después de un toque del jugador: unlock() se llama en el primer toque.
 */

type Listener = (muted: boolean) => void;
const KEY = 'ps-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<Listener>();

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlock() {
  ac();
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch { /* sin almacenamiento */ }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.02);
  if (m) stopMusic();
  listeners.forEach((l) => l(m));
}
export function onMute(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; slideTo?: number } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, opts: { vol?: number; freq?: number; type?: BiquadFilterType; sweepTo?: number } = {}) {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime + start;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'lowpass';
  f.frequency.setValueAtTime(opts.freq ?? 1200, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(opts.vol ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}

// Escala pentatónica en Do: suena alegre y nunca desafina
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

export const sfx = {
  tap() {
    tone(880, 0, 0.06, { type: 'triangle', vol: 0.12 });
  },
  spinStart() {
    noise(0, 0.35, { vol: 0.18, freq: 400, type: 'bandpass', sweepTo: 2400 });
    tone(220, 0, 0.3, { type: 'triangle', vol: 0.12, slideTo: 440 });
  },
  reelStop(i: number) {
    tone(140 - i * 6, 0, 0.12, { type: 'sine', vol: 0.4, slideTo: 70 });
    noise(0, 0.06, { vol: 0.12, freq: 3000, type: 'highpass' });
  },
  winSmall() {
    [0, 2, 4].forEach((n, i) => tone(PENTA[n], i * 0.08, 0.18, { type: 'triangle', vol: 0.22 }));
  },
  winBig() {
    const seq = [0, 2, 4, 5, 4, 5, 7];
    seq.forEach((n, i) => tone(PENTA[n], i * 0.11, 0.25, { type: 'square', vol: 0.09 }));
    seq.forEach((n, i) => tone(PENTA[n] / 2, i * 0.11, 0.25, { type: 'triangle', vol: 0.18 }));
    tone(PENTA[7], seq.length * 0.11, 0.7, { type: 'triangle', vol: 0.25 });
  },
  coinTick() {
    tone(1800 + Math.random() * 400, 0, 0.05, { type: 'square', vol: 0.05 });
  },
  scatter() {
    [7, 5, 6, 4, 7].forEach((n, i) => tone(PENTA[n] * 1.5, i * 0.07, 0.4, { type: 'sine', vol: 0.15 }));
  },
  wheelTick() {
    tone(1200, 0, 0.03, { type: 'square', vol: 0.06 });
  },
  explosion() {
    noise(0, 1.1, { vol: 0.6, freq: 1800, sweepTo: 80 });
    tone(90, 0, 0.6, { type: 'sawtooth', vol: 0.25, slideTo: 30 });
  },
  cashout() {
    tone(1318.5, 0, 0.12, { type: 'square', vol: 0.08 });
    tone(1760, 0.09, 0.35, { type: 'square', vol: 0.08 });
    noise(0.05, 0.25, { vol: 0.12, freq: 6000, type: 'highpass' });
  },
  hop() {
    tone(392, 0, 0.09, { type: 'square', vol: 0.07, slideTo: 784 });
    tone(784, 0.07, 0.08, { type: 'triangle', vol: 0.1 });
  },
  horn() {
    tone(330, 0, 0.35, { type: 'sawtooth', vol: 0.09 });
    tone(415, 0, 0.35, { type: 'sawtooth', vol: 0.07 });
    tone(330, 0.42, 0.25, { type: 'sawtooth', vol: 0.09 });
    tone(415, 0.42, 0.25, { type: 'sawtooth', vol: 0.07 });
  },
  lose() {
    tone(330, 0, 0.18, { type: 'triangle', vol: 0.15, slideTo: 220 });
  },
};

// ---------- Motor del cohete (sube de tono con el multiplicador) ----------
let engine: { o: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;
export function engineStart() {
  const c = ac();
  if (!c || muted || engine) return;
  const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth';
  o2.type = 'triangle';
  o.frequency.value = 70;
  o2.frequency.value = 140;
  f.type = 'lowpass';
  f.frequency.value = 900;
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.3);
  o.connect(f);
  o2.connect(f);
  f.connect(g).connect(master!);
  o.start();
  o2.start();
  engine = { o, o2, g };
}
export function engineUpdate(mult: number) {
  if (!engine || !ctx) return;
  const f = 70 + Math.min(400, Math.log(mult) * 120);
  engine.o.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
  engine.o2.frequency.setTargetAtTime(f * 2, ctx.currentTime, 0.1);
}
export function engineStop() {
  if (!engine || !ctx) return;
  const e = engine;
  engine = null;
  e.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  e.o.stop(ctx.currentTime + 0.3);
  e.o2.stop(ctx.currentTime + 0.3);
}

// ---------- Música de fondo suave ----------
let musicTimer: number | undefined;
export function startMusic() {
  if (muted || musicTimer) return;
  const c = ac();
  if (!c) return;
  const chords = [[0, 2, 4], [1, 3, 5], [2, 4, 6], [1, 3, 4]];
  let bar = 0;
  const play = () => {
    if (muted) return stopMusic();
    const ch = chords[bar % chords.length];
    ch.forEach((n) => tone(PENTA[n] / 2, 0, 1.8, { type: 'sine', vol: 0.035 }));
    [0, 0.5, 1, 1.5].forEach((t, i) => tone(PENTA[ch[i % 3]], t, 0.3, { type: 'triangle', vol: 0.03 }));
    bar++;
  };
  play();
  musicTimer = window.setInterval(play, 2000);
}
export function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = undefined;
}
