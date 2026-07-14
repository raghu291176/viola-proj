"""AML Managed Online Endpoint scoring script.

Same real model as the baked-in worker (Basic Pitch), just served by AML instead
of running in the AKS pod. `VIOLAHUB_MODEL` selects which model this deployment
serves. Input: {"audio_b64": "<wav bytes>"}; output: real note events / MusicXML.
"""
from __future__ import annotations

import base64
import json
import os
import tempfile
from pathlib import Path

_MODEL = os.environ.get("VIOLAHUB_MODEL", "basic-pitch")


def init() -> None:
    # Warm the model once per deployment instance (no per-request cold start).
    if _MODEL == "basic-pitch":
        from basic_pitch import ICASSP_2022_MODEL_PATH  # noqa: F401


def run(raw_data: str) -> str:
    data = json.loads(raw_data)
    audio = base64.b64decode(data["audio_b64"])
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "in.wav"
        path.write_bytes(audio)
        if _MODEL == "basic-pitch":
            from basic_pitch.inference import predict
            from basic_pitch import ICASSP_2022_MODEL_PATH
            _out, midi, notes = predict(str(path), ICASSP_2022_MODEL_PATH)
            return json.dumps({
                "notes": [
                    {"start": float(s), "end": float(e), "pitch_midi": int(p), "amplitude": float(a)}
                    for (s, e, p, a, _b) in notes
                ],
                "tempo_bpm": float(midi.estimate_tempo()),
            })
        if _MODEL == "oemer":
            from worker.models.omr import to_musicxml   # reuse the real OMR wrapper
            return json.dumps({"musicxml": to_musicxml(path)})
    raise ValueError(f"unknown model {_MODEL}")
