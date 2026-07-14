"""MIR accuracy benchmark harness (ARCHITECTURE.md §4 / gap #1).

Measures our pitch + note-detection accuracy against ground truth using the
industry-standard `mir_eval` metrics a professional tool publishes:

  Pitch (melody):  Raw Pitch Accuracy, Raw Chroma Accuracy, voicing recall/
                   false-alarm, plus mean/median |cents error| (bounds how
                   precise our intonation feedback can be).
  Notes:           onset P/R/F (±50 ms) and note (onset+pitch) P/R/F; the
                   note false-positive rate = 1 − precision.

Two ways to run:
  • Real corpus — URMP violin/viola stems (download separately, CC-BY-NC → internal
    benchmarking only):
        python -m scripts.benchmark --urmp /path/to/URMP/Dataset
  • Self-test — synthetic audio with known f0/notes (no download), proves the
    harness works and gives a baseline for the current pyin detector:
        python -m scripts.benchmark

Swap the detector (pyin today → CREPE/PESTO later) with --detector to compare;
the harness makes that an apples-to-apples number.
"""
from __future__ import annotations

import argparse
import glob
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np

SR = 22050


# ── detectors (what our product uses; swappable) ────────────────────────────
def detect_f0_pyin(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    """Return (times, f0_hz) with unvoiced frames as 0 — same detector matching uses."""
    import librosa
    f0, voiced, _p = librosa.pyin(
        y, sr=sr, fmin=float(librosa.note_to_hz("C2")), fmax=float(librosa.note_to_hz("A6"))
    )
    times = librosa.times_like(f0, sr=sr)
    est = np.where(np.isfinite(f0) & (voiced if voiced is not None else True), f0, 0.0)
    return times, np.nan_to_num(est)


DETECTORS = {"pyin": detect_f0_pyin}


# ── ground-truth cases ──────────────────────────────────────────────────────
@dataclass
class Case:
    name: str
    y: np.ndarray
    sr: int
    ref_times: np.ndarray      # f0 annotation times
    ref_f0: np.ndarray         # f0 in Hz (0 = unvoiced)
    ref_notes: list[tuple[float, float, float]]  # (onset_s, offset_s, hz)


def synthetic_case(ref_a: float = 442.0) -> Case:
    """A viola-range melody with realistic 5 Hz vibrato — known f0 and notes."""
    steps = [("C", 4), ("D", 4), ("E", 4), ("F", 4), ("G", 4), ("A", 4), ("G", 4), ("E", 4)]
    STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    dur = 0.6
    hop = 256
    y = np.zeros(0, dtype=np.float32)
    ref_times: list[float] = []
    ref_f0: list[float] = []
    ref_notes: list[tuple[float, float, float]] = []
    t_global = 0.0
    for step, octv in steps:
        midi = (octv + 1) * 12 + STEP[step]
        base = ref_a * 2 ** ((midi - 69) / 12)
        n = int(SR * dur)
        t = np.linspace(0, dur, n, endpoint=False)
        vib = 8.0 * np.sin(2 * np.pi * 5.0 * t)          # ±8 cents, 5 Hz
        inst_f = base * 2 ** (vib / 1200)
        phase = 2 * np.pi * np.cumsum(inst_f) / SR
        wave = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.18 * np.sin(3 * phase)
        env = np.minimum(1, np.minimum(t / 0.02, (dur - t) / 0.05))
        y = np.concatenate([y, (0.25 * wave * env).astype(np.float32)])
        # ground-truth f0 sampled on the hop grid
        for k in range(0, n, hop):
            ref_times.append(t_global + k / SR)
            ref_f0.append(float(inst_f[k]))
        ref_notes.append((t_global, t_global + dur, base))
        t_global += dur
    return Case("synthetic-vibrato", y, SR, np.array(ref_times), np.array(ref_f0), ref_notes)


def urmp_cases(root: str, instruments=("vn", "va", "vc")) -> list[Case]:
    """Load URMP stems for strings. URMP layout per piece dir:
       AuSep_<k>_<inst>_<piece>.wav, F0s_<k>_<inst>_<piece>.txt (time f0),
       Notes_<k>_<inst>_<piece>.txt (onset dur midi)."""
    import soundfile as sf
    cases: list[Case] = []
    for f0_path in glob.glob(os.path.join(root, "*", "F0s_*.txt")):
        base = os.path.basename(f0_path)
        parts = base[:-4].split("_")  # F0s, k, inst, piece...
        inst = parts[2]
        if inst not in instruments:
            continue
        d = os.path.dirname(f0_path)
        wav = glob.glob(os.path.join(d, f"AuSep_{parts[1]}_{inst}_*.wav"))
        notes_path = glob.glob(os.path.join(d, f"Notes_{parts[1]}_{inst}_*.txt"))
        if not wav:
            continue
        y, sr = sf.read(wav[0])
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != SR:
            import librosa
            y = librosa.resample(y.astype(float), orig_sr=sr, target_sr=SR)
            sr = SR
        arr = np.loadtxt(f0_path)
        ref_times, ref_f0 = arr[:, 0], arr[:, 1]
        ref_notes: list[tuple[float, float, float]] = []
        if notes_path:
            na = np.loadtxt(notes_path[0])
            na = na.reshape(-1, 3)
            for onset, ndur, midi in na:
                ref_notes.append((onset, onset + ndur, 440.0 * 2 ** ((midi - 69) / 12)))
        cases.append(Case(f"URMP:{base}", y.astype(np.float32), sr, ref_times, ref_f0, ref_notes))
    return cases


# ── evaluation ──────────────────────────────────────────────────────────────
def eval_case(case: Case, detector: str) -> dict[str, float]:
    import mir_eval
    from worker.models.matching import _segment_notes

    est_times, est_f0 = DETECTORS[detector](case.y, case.sr)

    ref_voicing = case.ref_f0 > 0
    mel = mir_eval.melody.evaluate(case.ref_times, case.ref_f0 * ref_voicing,
                                   est_times, est_f0)

    # Our own precision metric: |cents error| where both ref & est are voiced.
    # Nearest-sample est f0 onto the ref grid, compute cents on shared voiced frames.
    idx = np.searchsorted(est_times, case.ref_times).clip(0, len(est_times) - 1)
    est_on_ref = est_f0[idx]
    both = (case.ref_f0 > 0) & (est_on_ref > 0)
    cents = 1200 * np.log2(np.clip(est_on_ref[both], 1e-6, None) / np.clip(case.ref_f0[both], 1e-6, None))
    cents = cents[np.abs(cents) < 200]  # ignore octave/gross tracking errors for the cents-precision stat
    mean_cents = float(np.mean(np.abs(cents))) if len(cents) else float("nan")
    median_cents = float(np.median(np.abs(cents))) if len(cents) else float("nan")

    out = {
        "raw_pitch_acc": float(mel["Raw Pitch Accuracy"]),
        "raw_chroma_acc": float(mel["Raw Chroma Accuracy"]),
        "voicing_recall": float(mel["Voicing Recall"]),
        "voicing_false_alarm": float(mel["Voicing False Alarm"]),
        "mean_abs_cents": mean_cents,
        "median_abs_cents": median_cents,
    }

    if case.ref_notes:
        perf = _segment_notes(case.y, case.sr, 442.0)
        est_int = np.array([[p.start, p.end] for p in perf]) if perf else np.zeros((0, 2))
        est_pit = np.array([p.f0 for p in perf]) if perf else np.zeros(0)
        ref_int = np.array([[o, off] for o, off, _ in case.ref_notes])
        ref_pit = np.array([hz for _, _, hz in case.ref_notes])
        p, r, f, _ = mir_eval.transcription.precision_recall_f1_overlap(
            ref_int, ref_pit, est_int, est_pit, onset_tolerance=0.05, offset_ratio=None,
            pitch_tolerance=50.0)
        onf, onp, onr = mir_eval.onset.f_measure(ref_int[:, 0], est_int[:, 0], window=0.05)
        out.update({
            "note_precision": float(p), "note_recall": float(r), "note_f": float(f),
            "note_false_pos_rate": float(1 - p),
            "onset_f": float(onf),
        })
    return out


def _fmt(v: float) -> str:
    return f"{v:.3f}" if abs(v) < 100 else f"{v:.1f}"


def main() -> None:
    ap = argparse.ArgumentParser(description="ViolaHub MIR accuracy benchmark")
    ap.add_argument("--urmp", help="path to the URMP Dataset root (strings benchmarked)")
    ap.add_argument("--detector", default="pyin", choices=list(DETECTORS))
    ap.add_argument("--limit", type=int, default=8, help="max URMP stems")
    args = ap.parse_args()

    cases = urmp_cases(args.urmp)[: args.limit] if args.urmp else [synthetic_case()]
    print(f"# ViolaHub MIR benchmark — detector={args.detector}, {len(cases)} case(s)\n")

    agg: dict[str, list[float]] = {}
    for c in cases:
        m = eval_case(c, args.detector)
        print(f"## {c.name}")
        for k, v in m.items():
            print(f"   {k:22} {_fmt(v)}")
            agg.setdefault(k, []).append(v)
        print()

    if len(cases) > 1:
        print("## AGGREGATE (mean over cases)")
        for k, vals in agg.items():
            vals = [v for v in vals if not np.isnan(v)]
            if vals:
                print(f"   {k:22} {_fmt(float(np.mean(vals)))}")


if __name__ == "__main__":
    main()
