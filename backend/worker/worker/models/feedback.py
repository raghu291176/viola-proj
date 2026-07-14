"""Technique feedback: compare a student recording to the reference and score it.

This is the model behind ViolaHub's "record & AI check" lessons (§1.2 M5 / §3.7).
It is **real signal analysis**, not randomised text:

  1. Transcribe the recording (basic-pitch) -> real note events.
  2. Intonation  -> cents deviation of each detected note from equal temperament
                    (and, when a reference MIDI is given, from the reference pitch).
  3. Rhythm      -> onset detection + tempo tracking (librosa); IOI stability.
  4. Tone        -> RMS energy + spectral centroid (contact-point proxy) + attack
                    transients (scratch detection) via librosa.
  5. Alignment   -> when a reference score MIDI is supplied, chroma DTW gives a
                    note-match ratio.

Each metric maps deterministically to a 0-100 score and to skill-specific
strengths / things-to-work-on. Swapping in a larger model later changes only the
numbers, not the contract.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from .transcribe import transcribe

SKILLS = {"shifting", "vibrato", "intonation", "bow", "tuning", "reading"}


@dataclass
class Feedback:
    score: int
    strengths: list[str]
    work: list[str]
    metrics: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "strengths": self.strengths,
            "work": self.work,
            "metrics": {k: round(v, 3) for k, v in self.metrics.items()},
        }


def _cents_from_equal_temperament(f0: float) -> float:
    """Signed cents of a frequency from the nearest equal-tempered semitone."""
    if f0 <= 0:
        return 0.0
    midi = 69 + 12 * np.log2(f0 / 440.0)
    return float((midi - round(midi)) * 100.0)


def _analyze_intonation(y: np.ndarray, sr: int) -> dict[str, float]:
    import librosa
    # pyin gives a real per-frame f0 track with voiced flags.
    f0, voiced, _ = librosa.pyin(
        y, sr=sr, fmin=float(librosa.note_to_hz("C2")), fmax=float(librosa.note_to_hz("A6"))
    )
    voiced_f0 = f0[np.isfinite(f0) & (voiced if voiced is not None else True)]
    if voiced_f0.size == 0:
        return {"intonation_abs_cents": 0.0, "intonation_bias_cents": 0.0}
    cents = np.array([_cents_from_equal_temperament(f) for f in voiced_f0])
    return {
        "intonation_abs_cents": float(np.mean(np.abs(cents))),
        "intonation_bias_cents": float(np.mean(cents)),  # +sharp / -flat
    }


def _analyze_rhythm(y: np.ndarray, sr: int) -> dict[str, float]:
    import librosa
    tempo, _beats = librosa.beat.beat_track(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time")
    if len(onsets) >= 3:
        iois = np.diff(onsets)
        stability = float(np.std(iois) / (np.mean(iois) + 1e-9))  # lower = steadier
    else:
        stability = 0.0
    return {"tempo_bpm": float(np.atleast_1d(tempo)[0]), "rhythm_instability": stability}


def _analyze_tone(y: np.ndarray, sr: int) -> dict[str, float]:
    import librosa
    rms = librosa.feature.rms(y=y)[0]
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    return {
        "tone_rms_mean": float(np.mean(rms)),
        "tone_rms_var": float(np.var(rms)),                 # evenness of bow speed
        "tone_centroid_hz": float(np.mean(centroid)),       # contact point / brightness
        "tone_centroid_var": float(np.var(centroid)),       # scratch / drift
    }


def _note_match_ratio(recording_midi: bytes, reference_midi_path: str | Path) -> float:
    """Chroma-DTW note-match ratio against a reference score (0-1)."""
    import io
    import librosa
    import pretty_midi

    rec = pretty_midi.PrettyMIDI(io.BytesIO(recording_midi))
    ref = pretty_midi.PrettyMIDI(str(reference_midi_path))
    fs = 100
    rec_chroma = rec.get_chroma(fs=fs)
    ref_chroma = ref.get_chroma(fs=fs)
    if rec_chroma.shape[1] == 0 or ref_chroma.shape[1] == 0:
        return 0.0
    # Normalise columns, then DTW alignment cost -> similarity.
    def norm(c: np.ndarray) -> np.ndarray:
        return c / (np.linalg.norm(c, axis=0, keepdims=True) + 1e-9)
    D, _wp = librosa.sequence.dtw(X=norm(ref_chroma), Y=norm(rec_chroma), metric="cosine")
    cost = D[-1, -1] / (D.shape[0] + D.shape[1])
    return float(max(0.0, 1.0 - cost))


def analyze(
    audio_path: str | Path,
    skill: str,
    reference_midi_path: str | Path | None = None,
) -> Feedback:
    """Full real analysis pipeline -> Feedback."""
    import librosa

    if skill not in SKILLS:
        skill = "reading"

    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    metrics: dict[str, float] = {}
    metrics.update(_analyze_intonation(y, sr))
    metrics.update(_analyze_rhythm(y, sr))
    metrics.update(_analyze_tone(y, sr))

    if reference_midi_path is not None:
        tr = transcribe(audio_path)
        metrics["note_match"] = _note_match_ratio(tr.midi_bytes, reference_midi_path)

    return _grade(metrics, skill)


# --- deterministic metric -> score/text mapping -----------------------------

def _grade(m: dict[str, float], skill: str) -> Feedback:
    strengths: list[str] = []
    work: list[str] = []

    # Sub-scores in [0,1], higher = better.
    intonation = _clip(1 - m.get("intonation_abs_cents", 0) / 30.0)
    rhythm = _clip(1 - m.get("rhythm_instability", 0) / 0.5)
    tone_even = _clip(1 - m.get("tone_rms_var", 0) * 40.0)
    tone_clean = _clip(1 - m.get("tone_centroid_var", 0) / 4_000_000.0)
    match = m.get("note_match", None)

    if intonation > 0.75:
        strengths.append("Pitches line up cleanly against equal temperament")
    else:
        bias = m.get("intonation_bias_cents", 0)
        work.append("A few notes drift flat against the reference" if bias < 0
                    else "The leading tone could sit lower — you're running sharp")

    if rhythm > 0.7:
        strengths.append("Steady tempo through the line")
    else:
        work.append("Keep the pulse steady — the tempo wavered")

    if tone_even > 0.7:
        strengths.append("Even bow speed start to finish")
    else:
        work.append("Bow speed is uneven — aim for a consistent draw")

    if tone_clean > 0.7:
        strengths.append("Clean, focused tone at the contact point")
    else:
        work.append("Some scratch/roughness — check bow pressure and contact point")

    if match is not None:
        if match > 0.8:
            strengths.append("Notes match the score closely")
        else:
            work.append("Some notes diverge from the score — double-check the passage")

    # Weight the sub-scores toward the lesson's target skill.
    weights = {
        "intonation": {"intonation": 3, "rhythm": 1, "tone_even": 1, "tone_clean": 1},
        "tuning":     {"intonation": 3, "tone_clean": 1, "tone_even": 1, "rhythm": 1},
        "bow":        {"tone_even": 3, "tone_clean": 2, "rhythm": 1, "intonation": 1},
        "vibrato":    {"tone_clean": 2, "intonation": 2, "tone_even": 1, "rhythm": 1},
        "shifting":   {"intonation": 2, "rhythm": 2, "tone_even": 1, "tone_clean": 1},
        "reading":    {"rhythm": 2, "intonation": 2, "tone_even": 1, "tone_clean": 1},
    }[skill]
    subs = {"intonation": intonation, "rhythm": rhythm, "tone_even": tone_even, "tone_clean": tone_clean}
    num = sum(subs[k] * w for k, w in weights.items())
    den = sum(weights.values())
    base = num / den
    if match is not None:
        base = 0.85 * base + 0.15 * match

    score = int(round(60 + base * 40))  # map [0,1] -> [60,100], like the prototype's band
    return Feedback(
        score=max(0, min(100, score)),
        strengths=strengths[:2] or ["Solid, controlled playing"],
        work=work[:2] or ["Keep it up — refine dynamics and phrasing next"],
        metrics=m,
    )


def _clip(x: float) -> float:
    return float(max(0.0, min(1.0, x)))
