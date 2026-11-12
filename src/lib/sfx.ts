// Sound effects, synthesised with the Web Audio API — no audio files to
// download. Everything is quiet, short and optional (see `setMuted`).

const MUTE_KEY = 'sp:muted';
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}
export function setMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
}

/**
 * Browsers only allow sound after a tap or key press. Call this from inside
 * the event handler (before any `await`) so later sounds are allowed to play.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || isMuted()) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

function ready(): AudioContext | null {
  if (!ctx || isMuted() || ctx.state !== 'running') return null;
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // one second of white noise
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

function noiseSource(ac: AudioContext, at: number, length: number): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.start(at, Math.random() * 0.5);
  src.stop(at + length);
  return src;
}

/** A pencil scratching a word out: a few quick back-and-forth strokes of gritty noise. */
export function playScratch(): void {
  const ac = ready();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02;
  const strokes = [0.11, 0.09, 0.1, 0.08, 0.13];
  const total = strokes.reduce((a, b) => a + b, 0) + 0.05;

  const src = noiseSource(ac, t0, total);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass'; band.Q.value = 0.9;
  const high = ac.createBiquadFilter();
  high.type = 'highpass'; high.frequency.value = 900;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, t0);

  let t = t0;
  strokes.forEach((len, i) => {
    const forward = i % 2 === 0;
    // Each stroke swells and dies, and the pitch of the grit slides with the hand's speed.
    band.frequency.setValueAtTime(forward ? 2600 : 3900, t);
    band.frequency.exponentialRampToValueAtTime(forward ? 4300 : 2400, t + len);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16 + Math.random() * 0.05, t + len * 0.35);
    gain.gain.linearRampToValueAtTime(0.02, t + len);
    t += len;
  });
  gain.gain.linearRampToValueAtTime(0, t + 0.04);
  src.connect(high).connect(band).connect(gain).connect(ac.destination);
}

/** A rubber stamp hitting paper on a desk: a low thump under a short slap. */
export function playStamp(delay = 0): void {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.02 + delay;

  const thump = ac.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(140, t);
  thump.frequency.exponentialRampToValueAtTime(42, t + 0.16);
  const thumpGain = ac.createGain();
  thumpGain.gain.setValueAtTime(0.0001, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  thump.connect(thumpGain).connect(ac.destination);
  thump.start(t); thump.stop(t + 0.26);

  const slap = noiseSource(ac, t, 0.09);
  const low = ac.createBiquadFilter();
  low.type = 'lowpass'; low.frequency.value = 1700;
  const slapGain = ac.createGain();
  slapGain.gain.setValueAtTime(0.32, t);
  slapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
  slap.connect(low).connect(slapGain).connect(ac.destination);
}

/** A small, soft three-note chime — a notification, not a fanfare. */
export function playChime(delay = 0): void {
  const ac = ready();
  if (!ac) return;
  const t0 = ac.currentTime + 0.02 + delay;
  [659.25, 830.61, 987.77].forEach((freq, i) => { // E5, G#5, B5
    const t = t0 + i * 0.11;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const overtone = ac.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.value = freq * 2;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    const overGain = ac.createGain();
    overGain.gain.value = 0.18;
    osc.connect(gain);
    overtone.connect(overGain).connect(gain);
    gain.connect(ac.destination);
    osc.start(t); overtone.start(t);
    osc.stop(t + 0.75); overtone.stop(t + 0.75);
  });
}

/** Right answer: the "case closed" stamp lands, then the chime. */
export function playSolved(): void {
  playStamp(0.2);
  playChime(0.42);
}

/** Out of guesses: the last scratch, then the "cold case" stamp. */
export function playFailed(): void {
  playScratch();
  playStamp(0.75);
}
