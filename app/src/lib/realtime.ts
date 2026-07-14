// T1 on-device real-time layer (ARCHITECTURE.md §4.1) — live intonation cues
// while you play, from real autocorrelation DSP. Zero backend, zero latency,
// commercial-safe (no model weights). CREPE-tiny (ONNX/WASM) is the upgrade path
// behind this same interface; the store's `liveCue` selector is unchanged.
import { detectPitch } from './audio';
import { NOTES } from './constants';

export interface LiveCue {
  note: string;
  cents: number;
  status: 'in-tune' | 'sharp' | 'flat' | 'silent';
  hz: number;
}

const IN_TUNE_CENTS = 10;

let stream: MediaStream | null = null;
let ac: AudioContext | null = null;
let raf = 0;

export const liveEngine = {
  /** Begin live pitch cues. Resolves once the mic is live; rejects if denied. */
  start(onCue: (cue: LiveCue) => void): Promise<void> {
    return navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      stream = s;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      const src = ac.createMediaStreamSource(s);
      const an = ac.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let last = 0;
      const loop = (t: number): void => {
        raf = requestAnimationFrame(loop);
        if (t - last < 60) return;   // ~16 fps — live feel, cheap
        last = t;
        an.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ac!.sampleRate);
        if (f <= 0) { onCue({ note: '', cents: 0, status: 'silent', hz: 0 }); return; }
        const midi = 69 + 12 * Math.log2(f / 440);
        const near = Math.round(midi);
        const cents = Math.round((midi - near) * 100);
        const note = NOTES[((near % 12) + 12) % 12] + (Math.floor(near / 12) - 1);
        const status: LiveCue['status'] = Math.abs(cents) <= IN_TUNE_CENTS ? 'in-tune' : cents > 0 ? 'sharp' : 'flat';
        onCue({ note, cents, status, hz: Math.round(f) });
      };
      raf = requestAnimationFrame(loop);
    });
  },
  stop(): void {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((tr) => tr.stop());
    stream = null;
    try { ac?.close(); } catch { /* already closed */ }
    ac = null;
  },
};
