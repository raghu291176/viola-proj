"""Fetch & warm the real pretrained models at image build time.

Run by the worker Dockerfile (`RUN python -m worker.fetch_models`) so the weights
are baked into the image and the model graph is compiled before any request —
no first-request download, no cold-start weight fetch in production.

What it does (all real):
  1. Resolves the basic-pitch ICASSP-2022 model shipped with the package and
     asserts the weight file exists.
  2. Synthesises a 1-second A440 tone and runs a real inference pass, which
     forces the ONNX/TF graph to load and caches it. Build fails loudly if the
     model can't load or run — so a broken image never ships.

CREPE / pyin (used for the on-device + intonation paths) are DSP or download on
first use; this script warms what actually ships in the worker image.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path


def _synth_a440(path: Path, seconds: float = 1.0, sr: int = 22050) -> None:
    import numpy as np
    import soundfile as sf

    t = np.linspace(0, seconds, int(sr * seconds), endpoint=False)
    y = 0.2 * np.sin(2 * np.pi * 440.0 * t).astype("float32")
    sf.write(str(path), y, sr)


def main() -> int:
    from basic_pitch import ICASSP_2022_MODEL_PATH

    model_path = Path(str(ICASSP_2022_MODEL_PATH))
    if not model_path.exists():
        print(f"[fetch_models] FATAL: basic-pitch model not found at {model_path}", file=sys.stderr)
        return 1
    print(f"[fetch_models] basic-pitch model present: {model_path}")

    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "warm.wav"
        _synth_a440(wav)
        print("[fetch_models] running a warm-up inference pass...")
        from worker.models.transcribe import transcribe

        tr = transcribe(wav)
        print(f"[fetch_models] warm-up OK: {len(tr.notes)} notes detected, "
              f"tempo≈{tr.tempo_bpm:.0f} bpm, {len(tr.midi_bytes)} MIDI bytes")

    print("[fetch_models] models fetched and warmed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
