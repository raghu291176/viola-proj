"""Sheet ↔ played-audio matching — the teaching core (ARCHITECTURE.md §4.4).

Real pipeline, no stubs:
  1. Parse the reference MusicXML → ordered reference events, each carrying its
     note `id` (the xml:id bridge Verovio uses to recolor the exact note).
  2. Estimate performance events from the recording (Basic Pitch) + a continuous
     f0 track (librosa pyin) for cents-accurate intonation.
  3. DTW-align the performance to the reference (absorbs rushing/dragging).
  4. Judge each aligned note against level thresholds → per-note verdict.
  5. Return {noteId → verdict} + a real match score.

Output shape matches the client's `NoteVerdict` so Verovio can recolor notes
(green in-tune / red sharp-flat-wrong / amber late / grey missing).
"""
from __future__ import annotations

from defusedxml.ElementTree import fromstring as _xml_fromstring  # XXE/billion-laughs safe
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

import numpy as np

from .thresholds import policy, Thresholds
from .transcribe import transcribe

_STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


@dataclass
class RefEvent:
    note_id: str
    midi: int
    onset_beat: float
    duration_beats: float
    measure: int


@dataclass
class NoteVerdict:
    noteId: str
    kind: str                 # good | sharp | flat | late | early | wrong | missing
    detail: str
    cents: float | None = None
    timing_ms: float | None = None
    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}


def parse_reference(musicxml: str) -> list[RefEvent]:
    """Ordered reference events from MusicXML, each keyed by its note id."""
    root = _xml_fromstring(musicxml)
    events: list[RefEvent] = []
    divisions = 1.0
    for measure in root.iter("measure"):
        try:
            mnum = int(measure.get("number", "0"))
        except ValueError:
            mnum = 0
        onset = 0.0  # in quarter-note beats, relative to measure start
        prev_onset = 0.0
        for note in measure.findall("note"):
            div_el = measure.find("attributes/divisions")
            if div_el is not None and div_el.text:
                divisions = float(div_el.text)
            dur_el = note.find("duration")
            dur_beats = (float(dur_el.text) / divisions) if (dur_el is not None and dur_el.text) else 0.0
            is_chord = note.find("chord") is not None
            if note.find("rest") is not None:
                onset += dur_beats
                continue
            pitch = note.find("pitch")
            if pitch is None:
                onset += dur_beats
                continue
            step = (pitch.findtext("step") or "C").upper()
            octave = int(pitch.findtext("octave") or "4")
            alter = int(pitch.findtext("alter") or "0")
            midi = (octave + 1) * 12 + _STEP.get(step, 0) + alter
            this_onset = prev_onset if is_chord else onset
            events.append(RefEvent(
                note_id=note.get("id", f"m{mnum}-{len(events)}"),
                midi=midi, onset_beat=this_onset, duration_beats=dur_beats, measure=mnum,
            ))
            if not is_chord:
                prev_onset = onset
                onset += dur_beats
    return events


def _dtw_path(ref: list[int], perf: list[int]) -> list[tuple[int, int]]:
    """Classic DTW over MIDI-pitch sequences; returns aligned (ref_i, perf_j) pairs."""
    n, m = len(ref), len(perf)
    if n == 0 or m == 0:
        return []
    inf = float("inf")
    D = np.full((n + 1, m + 1), inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = min(abs(ref[i - 1] - perf[j - 1]), 12)  # cap so octave errors don't dominate
            D[i, j] = cost + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    # Backtrack.
    path: list[tuple[int, int]] = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        step = min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
        if step == D[i - 1, j - 1]:
            i, j = i - 1, j - 1
        elif step == D[i - 1, j]:
            i -= 1
        else:
            j -= 1
    return path[::-1]


def _cents(f0: float, target_midi: int) -> float:
    if f0 <= 0:
        return 0.0
    perf_midi = 69 + 12 * np.log2(f0 / 440.0)
    return float((perf_midi - target_midi) * 100.0)


def analyze(audio_path: str | Path, musicxml: str, level: str | None = None) -> dict[str, Any]:
    """Full match: per-note verdicts + match score against the reference score."""
    import librosa

    th: Thresholds = policy(level)
    ref = parse_reference(musicxml)
    if not ref:
        return {"note_verdicts": [], "score": 0, "matched": 0, "total": 0}

    tr = transcribe(audio_path)
    perf = tr.notes  # list of NoteEvent(start,end,pitch_midi,amplitude), onset-sorted

    # Continuous f0 for cents-accurate intonation at each note's onset.
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    f0, _voiced, _p = librosa.pyin(
        y, sr=sr, fmin=float(librosa.note_to_hz("C2")), fmax=float(librosa.note_to_hz("A6"))
    )
    times = librosa.times_like(f0, sr=sr)

    def f0_at(t: float) -> float:
        if len(times) == 0:
            return 0.0
        idx = int(np.argmin(np.abs(times - t)))
        val = f0[idx]
        return float(val) if np.isfinite(val) else 0.0

    path = _dtw_path([e.midi for e in ref], [p.pitch_midi for p in perf])
    ref_to_perf: dict[int, int] = {}
    for ri, pj in path:
        ref_to_perf.setdefault(ri, pj)  # first performance note aligned to this reference note

    # Tempo mapping: reference beats → seconds via the aligned onsets' linear fit.
    aligned = [(ref[ri].onset_beat, perf[pj].start) for ri, pj in ref_to_perf.items()]
    if len(aligned) >= 2:
        beats = np.array([a[0] for a in aligned]); secs = np.array([a[1] for a in aligned])
        slope, intercept = np.polyfit(beats, secs, 1)  # sec per beat
    else:
        slope, intercept = 0.5, 0.0

    verdicts: list[NoteVerdict] = []
    matched = 0
    for ri, e in enumerate(ref):
        if ri not in ref_to_perf:
            verdicts.append(NoteVerdict(e.note_id, "missing", f"m.{e.measure}: expected note not detected"))
            continue
        p = perf[ref_to_perf[ri]]
        # Wrong note? (aligned performance pitch is a different semitone)
        if abs(p.pitch_midi - e.midi) >= 1:
            verdicts.append(NoteVerdict(e.note_id, "wrong",
                f"m.{e.measure}: played {librosa.midi_to_note(p.pitch_midi)}, expected {librosa.midi_to_note(e.midi)}"))
            continue
        # Intonation (cents) from the continuous f0 at the note's onset.
        cents = _cents(f0_at(p.start), e.midi)
        # Timing vs expected onset time.
        expected_t = slope * e.onset_beat + intercept
        timing_ms = (p.start - expected_t) * 1000.0
        beat_frac = abs(timing_ms / 1000.0) / max(slope, 1e-6)

        if abs(cents) > th.intonation_cents:
            kind = "sharp" if cents > 0 else "flat"
            verdicts.append(NoteVerdict(e.note_id, kind,
                f"m.{e.measure}: {librosa.midi_to_note(e.midi)} played {cents:+.0f}¢ {'sharp' if cents>0 else 'flat'}",
                cents=round(cents, 1)))
        elif beat_frac > th.timing_beat_frac:
            kind = "late" if timing_ms > 0 else "early"
            verdicts.append(NoteVerdict(e.note_id, kind,
                f"m.{e.measure}: {'rushed' if timing_ms<0 else 'dragged'} ~{abs(timing_ms):.0f} ms",
                timing_ms=round(timing_ms, 0)))
        else:
            matched += 1
            verdicts.append(NoteVerdict(e.note_id, "good",
                f"m.{e.measure}: {librosa.midi_to_note(e.midi)} in tune, in time",
                cents=round(cents, 1)))

    total = len(ref)
    score = int(round(100 * matched / total)) if total else 0
    return {
        "note_verdicts": [v.to_dict() for v in verdicts],
        "score": score,
        "matched": matched,
        "total": total,
        "level": (level or "intermediate"),
    }
