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

from . import intonation
from .thresholds import policy, Thresholds

_STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


@dataclass
class RefEvent:
    note_id: str
    midi: int
    onset_beat: float
    duration_beats: float
    measure: int
    key_fifths: int = 0   # from the MusicXML key signature (for tuning-system intonation)


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
    fifths = 0
    onset = 0.0       # ABSOLUTE onset in quarter-note beats (cumulative across measures)
    prev_onset = 0.0  # onset of the previous non-chord note (so chord notes share it)
    for measure in root.iter("measure"):
        key_el = measure.find("attributes/key/fifths")
        if key_el is not None and key_el.text:
            fifths = int(key_el.text)
        try:
            mnum = int(measure.get("number", "0"))
        except ValueError:
            mnum = 0
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
                key_fifths=fifths,
            ))
            if not is_chord:
                prev_onset = onset
                onset += dur_beats
    return events


@dataclass
class PerfNote:
    midi: int          # rounded pitch
    f0: float          # median f0 over the STABLE middle of the note (Hz)
    start: float       # seconds
    end: float


def _segment_notes(y, sr: int, ref_a: float) -> list[PerfNote]:
    """Monophonic note segmentation from a pyin f0 track.

    For a solo line this is far more reliable than polyphonic note detection:
    group consecutive voiced frames of the same rounded pitch into a note, and
    take the median f0 over the note's *stable middle* (excludes attack/release)
    so intonation is measured where the pitch has settled.
    """
    import librosa
    f0, voiced, _prob = librosa.pyin(
        y, sr=sr, fmin=float(librosa.note_to_hz("C2")), fmax=float(librosa.note_to_hz("A6"))
    )
    times = librosa.times_like(f0, sr=sr)
    notes: list[PerfNote] = []
    cur_midi: int | None = None
    cur_f0s: list[float] = []
    cur_start = 0.0
    cur_end = 0.0

    def flush() -> None:
        nonlocal cur_midi, cur_f0s
        if cur_midi is not None and len(cur_f0s) >= 3:   # ≥ ~70 ms → reject blips
            s = sorted(cur_f0s)
            lo, hi = len(s) // 4, max(len(s) // 4 + 1, len(s) * 3 // 4)  # middle 50%
            notes.append(PerfNote(cur_midi, float(np.median(s[lo:hi])), cur_start, cur_end))
        cur_midi, cur_f0s = None, []

    for i, f in enumerate(f0):
        is_voiced = np.isfinite(f) and (bool(voiced[i]) if voiced is not None else True)
        if not is_voiced:
            flush()
            continue
        midi = int(round(69 + 12 * np.log2(f / ref_a)))
        if cur_midi is None:
            cur_midi, cur_f0s, cur_start, cur_end = midi, [float(f)], times[i], times[i]
        elif midi == cur_midi:
            cur_f0s.append(float(f)); cur_end = times[i]
        else:
            flush()
            cur_midi, cur_f0s, cur_start, cur_end = midi, [float(f)], times[i], times[i]
    flush()
    return notes


def _align(ref: list[int], perf: list[int]) -> list[tuple[int | None, int | None]]:
    """Needleman-Wunsch alignment of two pitch sequences (handles missing/extra).

    Returns (ref_index, perf_index) pairs; None on either side marks a gap
    (ref-only = missing note, perf-only = extra note).
    """
    n, m = len(ref), len(perf)
    GAP = -2.0
    D = np.zeros((n + 1, m + 1))
    for i in range(n + 1):
        D[i, 0] = i * GAP
    for j in range(m + 1):
        D[0, j] = j * GAP
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub = 2.0 if ref[i - 1] == perf[j - 1] else -min(abs(ref[i - 1] - perf[j - 1]), 4)
            D[i, j] = max(D[i - 1, j - 1] + sub, D[i - 1, j] + GAP, D[i, j - 1] + GAP)
    pairs: list[tuple[int | None, int | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sub = 2.0 if ref[i - 1] == perf[j - 1] else -min(abs(ref[i - 1] - perf[j - 1]), 4)
            if D[i, j] == D[i - 1, j - 1] + sub:
                pairs.append((i - 1, j - 1)); i, j = i - 1, j - 1; continue
        if i > 0 and D[i, j] == D[i - 1, j] + GAP:
            pairs.append((i - 1, None)); i -= 1
        else:
            pairs.append((None, j - 1)); j -= 1
    return pairs[::-1]


def _cents(f0: float, target_midi: int, ref_a: float) -> float:
    """Signed cents of f0 relative to the equal-tempered target, at reference A."""
    if f0 <= 0:
        return 0.0
    perf_midi = 69 + 12 * np.log2(f0 / ref_a)
    return float((perf_midi - target_midi) * 100.0)


def analyze(
    audio_path: str | Path,
    musicxml: str,
    level: str | None = None,
    ref_a: float = 442.0,
) -> dict[str, Any]:
    """Full match: per-note verdicts + match score against the reference score.

    Intonation is judged against the level's tuning **system** (expressive for
    advanced), not rigid equal temperament — see models/intonation.py.
    """
    import librosa

    th: Thresholds = policy(level)
    system = intonation.system_for(level)
    ref = parse_reference(musicxml)
    if not ref:
        return {"note_verdicts": [], "score": 0, "matched": 0, "total": 0}

    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    perf = _segment_notes(y, sr, ref_a)
    pairs = _align([e.midi for e in ref], [p.midi for p in perf])
    ref_to_perf = {ri: pj for ri, pj in pairs if ri is not None and pj is not None}

    # Robust tempo: median seconds-per-beat over consecutive matched pairs.
    matched_pairs = sorted(ref_to_perf.items())
    spb_samples = [
        (perf[matched_pairs[k + 1][1]].start - perf[matched_pairs[k][1]].start)
        / max(ref[matched_pairs[k + 1][0]].onset_beat - ref[matched_pairs[k][0]].onset_beat, 1e-6)
        for k in range(len(matched_pairs) - 1)
        if ref[matched_pairs[k + 1][0]].onset_beat > ref[matched_pairs[k][0]].onset_beat
    ]
    spb = float(np.median(spb_samples)) if spb_samples else 0.5
    if matched_pairs:
        r0, p0 = matched_pairs[0]
        t0 = perf[p0].start - ref[r0].onset_beat * spb   # seconds at beat 0
    else:
        t0 = 0.0

    verdicts: list[NoteVerdict] = []
    matched = 0
    for ri, e in enumerate(ref):
        name = librosa.midi_to_note(e.midi)
        if ri not in ref_to_perf:
            verdicts.append(NoteVerdict(e.note_id, "missing", f"m.{e.measure}: {name} not detected"))
            continue
        p = perf[ref_to_perf[ri]]
        if abs(p.midi - e.midi) >= 1:  # wrong note
            verdicts.append(NoteVerdict(e.note_id, "wrong",
                f"m.{e.measure}: played {librosa.midi_to_note(p.midi)}, expected {name}"))
            continue
        # Intonation vs the tuning SYSTEM's target for this scale degree.
        measured = _cents(p.f0, e.midi, ref_a)
        tonic = intonation.tonic_pc_from_fifths(e.key_fifths)
        expected = intonation.expected_offset(system, e.midi - tonic)
        dev = measured - expected
        # Timing vs expected onset (tempo-normalized).
        timing_ms = (p.start - (t0 + e.onset_beat * spb)) * 1000.0
        beat_frac = abs(timing_ms / 1000.0) / max(spb, 1e-6)

        if abs(dev) > th.intonation_cents:
            kind = "sharp" if dev > 0 else "flat"
            verdicts.append(NoteVerdict(e.note_id, kind,
                f"m.{e.measure}: {name} {dev:+.0f}¢ {'sharp' if dev > 0 else 'flat'} of {system} intonation",
                cents=round(dev, 1)))
        elif beat_frac > th.timing_beat_frac:
            kind = "late" if timing_ms > 0 else "early"
            verdicts.append(NoteVerdict(e.note_id, kind,
                f"m.{e.measure}: {name} {'dragged' if timing_ms > 0 else 'rushed'} ~{abs(timing_ms):.0f} ms",
                timing_ms=round(timing_ms, 0)))
        else:
            matched += 1
            verdicts.append(NoteVerdict(e.note_id, "good",
                f"m.{e.measure}: {name} in tune, in time", cents=round(dev, 1)))

    total = len(ref)
    score = int(round(100 * matched / total)) if total else 0
    return {
        "note_verdicts": [v.to_dict() for v in verdicts],
        "score": score,
        "matched": matched,
        "total": total,
        "level": (level or "intermediate"),
        "system": system,
        "ref_a": ref_a,
    }
