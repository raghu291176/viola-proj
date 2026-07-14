// ViolaHub Web Audio engine — metronome, drone, tuner.
// Ported from ViolaHub Prototype.dc.html Component audio methods, decoupled from React.
import { NOTES } from './constants';

// Reference pitch (A4). Orchestral players tune sharp of 440 — 442 is common
// (NY Phil ≈ 442), Baroque ≈ 415. Everything pitch-related reads this.
let referenceA = 442;
export function setReferenceA(hz: number): void { referenceA = hz; }
export function getReferenceA(): number { return referenceA; }

let ac: AudioContext | null = null;
function ctx(): AudioContext {
  if (!ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new AC();
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

// ── metronome — sample-accurate lookahead scheduler ─────────────────
// Pro-audio timing (Chris Wilson "A Tale of Two Clocks"): a coarse JS timer only
// *schedules* clicks slightly ahead on the AudioContext's sample clock, so every
// beat fires at an exact audio time — no setInterval drift or jitter. The visual
// beat is driven off the same clock via rAF, so sound and UI stay locked.
export interface MetParams { bpm: number; beats: number; accent: number; soundIdx: number }

const LOOKAHEAD_MS = 25;        // how often the scheduler wakes
const SCHEDULE_AHEAD_S = 0.12;  // how far ahead we schedule audio events

let metGet: (() => MetParams) | null = null;
let metOnBeat: ((beat: number) => void) | null = null;
let schedTimer: ReturnType<typeof setTimeout> | undefined;
let rafId = 0;
let nextBeatTime = 0;           // AudioContext time of the next beat
let schedBeat = 0;              // beat index being scheduled
let beatQueue: { beat: number; time: number }[] = [];
let displayedBeat = -1;

/** Schedule one click at an exact AudioContext time. */
function clickAt(soundIdx: number, hi: boolean, time: number): void {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = soundIdx === 0 ? 'square' : soundIdx === 1 ? 'sine' : 'triangle';
    o.frequency.value = soundIdx === 0 ? (hi ? 1400 : 1000)
      : soundIdx === 1 ? (hi ? 2100 : 1700) : (hi ? 880 : 660);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(hi ? 0.28 : 0.2, time + 0.002); // crisp attack
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    o.connect(g);
    g.connect(c.destination);
    o.start(time);
    o.stop(time + 0.07);
  } catch { /* audio unavailable */ }
}

function scheduler(): void {
  if (!metGet) return;
  const c = ctx();
  while (nextBeatTime < c.currentTime + SCHEDULE_AHEAD_S) {
    const p = metGet();
    const isAccent = p.accent > 0 && schedBeat === p.accent - 1;
    clickAt(p.soundIdx, isAccent, nextBeatTime);
    beatQueue.push({ beat: schedBeat, time: nextBeatTime });
    nextBeatTime += 60 / p.bpm;            // live BPM — tempo changes apply on the next beat
    schedBeat = (schedBeat + 1) % p.beats; // live meter
  }
  schedTimer = setTimeout(scheduler, LOOKAHEAD_MS);
}

/** rAF loop: flip the visual beat exactly when its scheduled audio time arrives. */
function draw(): void {
  const now = ctx().currentTime;
  let b = displayedBeat;
  while (beatQueue.length && beatQueue[0].time <= now) {
    b = beatQueue.shift()!.beat;
  }
  if (b !== displayedBeat) {
    displayedBeat = b;
    metOnBeat?.(b);
  }
  rafId = requestAnimationFrame(draw);
}

export const metronome = {
  /** Start ticking. `get` supplies live params; `onBeat` reports the active beat index. */
  start(get: () => MetParams, onBeat: (beat: number) => void): void {
    metGet = get;
    metOnBeat = onBeat;
    schedBeat = 0;
    displayedBeat = -1;
    beatQueue = [];
    nextBeatTime = ctx().currentTime + 0.06; // tiny lead-in
    scheduler();
    rafId = requestAnimationFrame(draw);
  },
  /** No-op: the lookahead scheduler picks up BPM/meter changes on the next beat. */
  reschedule(): void { /* live params are read every scheduler tick */ },
  running(): boolean {
    return schedTimer !== undefined;
  },
  stop(): void {
    clearTimeout(schedTimer);
    cancelAnimationFrame(rafId);
    schedTimer = undefined;
    beatQueue = [];
    displayedBeat = -1;
  },
};

// ── drone ───────────────────────────────────────────────────────────
export function droneFreq(note: string, oct: number): number {
  // Anchored to the current reference A (A4 = referenceA).
  return (referenceA / 440) * 220 * Math.pow(2, (NOTES.indexOf(note) - 9) / 12) * Math.pow(2, oct - 3);
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

export function detectPitch(buf: Float32Array, sr: number): number {
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
          const midi = 69 + 12 * Math.log2(f / referenceA);
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
