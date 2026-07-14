import { describe, it, expect } from 'vitest';
import { detectPitch, droneFreq, setReferenceA } from './audio';
import { tempoName } from './constants';

function sine(freq: number, sr = 44100, n = 2048): Float32Array {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = Math.sin((2 * Math.PI * freq * i) / sr);
  return buf;
}

describe('detectPitch (autocorrelation)', () => {
  it('recovers common viola-range pitches within ~1%', () => {
    for (const f of [220, 261.63, 440, 523.25]) {
      const est = detectPitch(sine(f), 44100);
      expect(est).toBeGreaterThan(0);
      expect(Math.abs(est - f) / f).toBeLessThan(0.01);
    }
  });

  it('returns -1 on silence (below the RMS gate)', () => {
    expect(detectPitch(new Float32Array(2048), 44100)).toBe(-1);
  });
});

describe('droneFreq (reference-pitch aware)', () => {
  it('anchors A4 to the reference pitch (440 and 442)', () => {
    setReferenceA(440);
    expect(droneFreq('A', 3)).toBeCloseTo(220, 5);
    expect(droneFreq('A', 4)).toBeCloseTo(440, 5);
    setReferenceA(442);
    expect(droneFreq('A', 4)).toBeCloseTo(442, 5);
    setReferenceA(442); // restore default
  });
  it('one octave up doubles the frequency (independent of reference)', () => {
    expect(droneFreq('C', 4) / droneFreq('C', 3)).toBeCloseTo(2, 5);
  });
});

describe('tempoName', () => {
  it('maps BPM to the right Italian tempo band', () => {
    expect(tempoName(50)).toBe('Largo');
    expect(tempoName(90)).toBe('Andante');
    expect(tempoName(140)).toBe('Allegro');
    expect(tempoName(210)).toBe('Prestissimo');
  });
});
