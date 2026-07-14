"""Prove the models actually run: synthesize a scored passage with deliberate
intonation errors, then run the REAL pipeline (Basic Pitch transcription +
matching + tuning-system intonation) and print per-note verdicts.

    cd backend/worker && . .venv/bin/activate && python -m scripts.demo_end_to_end
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from worker.models.transcribe import transcribe
from worker.models import matching

REF_A = 442.0
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

# Same content as the app's ALTO_EXERCISE reference score (C major, alto clef).
MUSICXML = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Viola</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>3</line></clef></attributes>
      <note id="e1"><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e2"><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e3"><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e4"><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note id="e5"><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e6"><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note id="e7"><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>"""


def midi_of(step: str, octave: int) -> int:
    return (octave + 1) * 12 + STEP[step]


def freq(midi: int, cents_err: float = 0.0) -> float:
    return REF_A * 2 ** ((midi - 69) / 12) * 2 ** (cents_err / 1200)


def synth() -> Path:
    """Render the passage as audio. Deliberate errors: E (m.1) +45¢ sharp, G late."""
    sr = 22050
    # (step, octave, seconds, cents_error, start_delay_s)
    plan = [
        ("C", 4, 0.5, 0, 0.0),
        ("D", 4, 0.5, 0, 0.0),
        ("E", 4, 0.5, +45, 0.0),   # deliberately sharp
        ("F", 4, 0.5, 0, 0.0),
        ("G", 4, 0.5, 0, 0.12),    # deliberately late (rushed reference → dragged)
        ("E", 4, 0.5, 0, 0.0),
        ("C", 4, 1.0, 0, 0.0),
    ]
    audio = np.zeros(0, dtype=np.float32)
    for step, octv, dur, cents, delay in plan:
        if delay:
            audio = np.concatenate([audio, np.zeros(int(sr * delay), dtype=np.float32)])
        n = int(sr * dur)
        t = np.linspace(0, dur, n, endpoint=False)
        f = freq(midi_of(step, octv), cents)
        # A few harmonics + gentle envelope so the pitch trackers lock like a real tone.
        wave = (np.sin(2 * np.pi * f * t)
                + 0.35 * np.sin(2 * np.pi * 2 * f * t)
                + 0.18 * np.sin(2 * np.pi * 3 * f * t))
        env = np.minimum(1, np.minimum(t / 0.02, (dur - t) / 0.05))
        audio = np.concatenate([audio, (0.25 * wave * env).astype(np.float32)])
    out = Path(tempfile.gettempdir()) / "violahub_demo.wav"
    sf.write(str(out), audio, sr)
    return out


def main() -> None:
    wav = synth()
    print(f"[demo] synthesized {wav} (C-D-E-F | G-E-C, E is +45¢ sharp, G late)\n")

    print("[demo] === Basic Pitch transcription (real model inference) ===")
    tr = transcribe(wav)
    print(f"  detected {len(tr.notes)} notes, tempo≈{tr.tempo_bpm:.0f} bpm")
    from music21 import pitch as m21pitch
    for nte in tr.notes[:12]:
        name = m21pitch.Pitch(midi=nte.pitch_midi).nameWithOctave
        print(f"    {nte.start:5.2f}s  {name:4}  (midi {nte.pitch_midi})")

    print("\n[demo] === Matching vs the score (advanced level, A=442, expressive intonation) ===")
    result = matching.analyze(wav, MUSICXML, level="advanced", ref_a=REF_A)
    print(f"  score={result['score']}%  matched {result['matched']}/{result['total']}  "
          f"system={result['system']}")
    for v in result["note_verdicts"]:
        print(f"    {v['noteId']:4}  {v['kind']:8}  {v['detail']}")

    print("\n[demo] raw note_verdicts JSON (what recolors the Verovio notes):")
    print(json.dumps(result["note_verdicts"], indent=2))


if __name__ == "__main__":
    main()
