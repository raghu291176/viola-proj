// ViolaHub Web Audio engine — metronome, drone, tuner.
// Ported from ViolaHub Prototype.dc.html Component audio methods, decoupled from React.
import { NOTES } from './constants';

let ac: AudioContext | null = null;
function ctx(): AudioContext {
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new AC();
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

// ── shared: click tone ──────────────────────────────────────────────
function click(soundIdx: number, hi: boolean): void {
  try {
    const c = ctx();
    const i = soundIdx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = i === 0 ? 'square' : i === 1 ? 'sine' : 'triangle';
    o.frequency.value = i === 0 ? (hi ? 1400 : 1000) : i === 1 ? (hi ? 2100 : 1700) : (hi ? 880 : 660);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.08);
  } catch { /* audio unavailable */ }
}

// ── metronome ───────────────────────────────────────────────────────
export interface MetParams { bpm: number; beats: number; accent: number; soundIdx: number }

let metIv: ReturnType<typeof setInterval> | undefined;
let metGet: (() => MetParams) | null = null;
let metOnBeat: ((beat: number) => void) | null = null;
let metBeat = -1;

function metTick(): void {
  if (!metGet || !metOnBeat) return;
  const p = metGet();
  const nb = (metBeat + 1) % p.beats;
  click(p.soundIdx, nb === p.accent - 1);
  metBeat = nb;
  metOnBeat(nb);
}
function metSchedule(): void {
  if (!metGet) return;
  clearInterval(metIv);
  metIv = setInterval(metTick, 60000 / metGet().bpm);
}

export const metronome = {
  /** Start ticking. `get` supplies live params; `onBeat` reports the active beat index. */
  start(get: () => MetParams, onBeat: (beat: number) => void): void {
    metGet = get;
    metOnBeat = onBeat;
    metBeat = 0;
    const p = get();
    click(p.soundIdx, p.accent === 1);
    onBeat(0);
    metSchedule();
  },
  /** Re-time the interval after a BPM change (only if running). */
  reschedule(): void {
    if (metIv) metSchedule();
  },
  running(): boolean {
    return metIv !== undefined;
  },
  stop(): void {
    clearInterval(metIv);
    metIv = undefined;
    metBeat = -1;
  },
};

// ── drone ───────────────────────────────────────────────────────────
export function droneFreq(note: string, oct: number): number {
  return 220 * Math.pow(2, (NOTES.indexOf(note) - 9) / 12) * Math.pow(2, oct - 3);
}

let osc: OscillatorNode | null = null;

export const drone = {
  start(note: string, oct: number): void {
    try {
      const c = ctx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = droneFreq(note, oct);
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      osc = o;
    } catch { /* audio unavailable */ }
  },
  retune(note: string, oct: number): void {
    if (osc) osc.frequency.value = droneFreq(note, oct);
  },
  stop(): void {
    try { osc?.stop(); } catch { /* already stopped */ }
    osc = null;
  },
};

// ── tuner (mic pitch detection) ─────────────────────────────────────
export interface Pitch { heard: string | null; cents: number; hz: number }

let stream: MediaStream | null = null;
let raf = 0;

function detectPitch(buf: Float32Array, sr: number): number {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < 0.012) return -1;
  let r1 = 0, r2 = n - 1;
  for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]) < 0.02) { r1 = i; break; }
  for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]) < 0.02) { r2 = n - i; break; }
  const b = buf.slice(r1, r2), m = b.length;
  const c = new Array(m).fill(0);
  for (let lag = 0; lag < m; lag++) for (let i = 0; i < m - lag; i++) c[lag] += b[i] * b[i + lag];
  let d = 0;
  while (d < m - 1 && c[d] > c[d + 1]) d++;
  let maxv = -1, maxp = -1;
  for (let i = d; i < m; i++) if (c[i] > maxv) { maxv = c[i]; maxp = i; }
  if (maxp <= 0) return -1;
  let T = maxp;
  const x1 = c[maxp - 1], x2 = c[maxp], x3 = c[maxp + 1] || x2;
  const a = (x1 + x3 - 2 * x2) / 2, bq = (x3 - x1) / 2;
  if (a) T = maxp - bq / (2 * a);
  const f = sr / T;
  return (f > 60 && f < 2000) ? f : -1;
}

export const tuner = {
  /** Begin listening. Resolves once the mic is live; rejects if permission denied. */
  start(onPitch: (p: Pitch) => void): Promise<void> {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      stream = s;
      const c = ctx();
      const src = c.createMediaStreamSource(s);
      const an = c.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let last = 0;
      const loop = (t: number): void => {
        raf = requestAnimationFrame(loop);
        if (t - last < 120) return;
        last = t;
        an.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, c.sampleRate);
        if (f > 0) {
          const midi = 69 + 12 * Math.log2(f / 440);
          const near = Math.round(midi);
          const cents = Math.max(-50, Math.min(50, Math.round((midi - near) * 100)));
          const name = NOTES[((near % 12) + 12) % 12] + (Math.floor(near / 12) - 1);
          onPitch({ heard: name, cents, hz: Math.round(f) });
        }
      };
      raf = requestAnimationFrame(loop);
    });
  },
  stop(): void {
    cancelAnimationFrame(raf);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  },
};

/** Global teardown for unmount. */
export function stopAllAudio(): void {
  metronome.stop();
  drone.stop();
  tuner.stop();
}
