"""Run the REAL models on a local WAV — no Azure, no GPU required.

Proves the model wiring works before any cloud exists:

    pip install -r backend/worker/requirements.txt
    python -m worker.scripts.local_analyze recording.wav --skill bow
    python -m worker.scripts.local_analyze song.wav --transcribe

`--reference ref.mid` adds chroma-DTW note matching against a reference score.
"""
from __future__ import annotations

import argparse
import json


def main() -> None:
    ap = argparse.ArgumentParser(description="Run ViolaHub models on a local audio file")
    ap.add_argument("audio", help="path to a WAV/MP3/etc. recording")
    ap.add_argument("--skill", default="reading",
                    choices=["shifting", "vibrato", "intonation", "bow", "tuning", "reading"])
    ap.add_argument("--reference", default=None, help="reference score .mid (optional)")
    ap.add_argument("--transcribe", action="store_true", help="run transcription instead of feedback")
    args = ap.parse_args()

    if args.transcribe:
        from worker.models.transcribe import transcribe
        tr = transcribe(args.audio)
        print(json.dumps(tr.summary(), indent=2))
    else:
        from worker.models.feedback import analyze
        fb = analyze(args.audio, skill=args.skill, reference_midi_path=args.reference)
        print(json.dumps(fb.to_dict(), indent=2))


if __name__ == "__main__":
    main()
