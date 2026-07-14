"""Audio -> notation transcription.

Real model: Spotify **basic-pitch** (ICASSP 2022), a pretrained polyphonic
note-detection network shipped with the `basic-pitch` package. This powers both:
  - ViolaHub "AI transcription" (turn any audio into sheet music), and
  - the first stage of technique feedback (transcribe the student's recording).

Nothing here is mocked: `predict()` runs the real network and returns real note
events. The only build/deploy concern is that the model weights are baked into
the worker image at build time (see ../fetch_models.py and ../../Dockerfile).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any


@dataclass
class NoteEvent:
    start: float          # seconds
    end: float            # seconds
    pitch_midi: int       # 0-127
    amplitude: float      # 0-1
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Transcription:
    notes: list[NoteEvent]
    tempo_bpm: float
    duration: float
    midi_bytes: bytes     # a real .mid rendering of the detected notes

    def summary(self) -> dict[str, Any]:
        return {
            "note_count": len(self.notes),
            "tempo_bpm": round(self.tempo_bpm, 1),
            "duration": round(self.duration, 2),
            "notes": [n.to_dict() for n in self.notes],
        }


def transcribe(audio_path: str | Path) -> Transcription:
    """Run basic-pitch on an audio file and return real note events + a MIDI render."""
    # Imported lazily so the module imports even where the heavy deps aren't
    # installed (e.g. the API image); the worker image has them (Dockerfile).
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH
    import io

    model_output, midi_data, note_events = predict(str(audio_path), ICASSP_2022_MODEL_PATH)

    notes = [
        NoteEvent(start=float(s), end=float(e), pitch_midi=int(p), amplitude=float(a))
        for (s, e, p, a, _bends) in note_events
    ]
    notes.sort(key=lambda n: n.start)

    # pretty_midi estimates tempo from the detected onsets.
    try:
        tempo_bpm = float(midi_data.estimate_tempo())
    except Exception:
        tempo_bpm = 0.0

    buf = io.BytesIO()
    midi_data.write(buf)
    duration = max((n.end for n in notes), default=0.0)

    return Transcription(
        notes=notes,
        tempo_bpm=tempo_bpm,
        duration=duration,
        midi_bytes=buf.getvalue(),
    )


def transcription_to_musicxml(midi_bytes: bytes) -> str:
    """Convert the detected MIDI to MusicXML (real notation) via music21.

    This is what the "AI transcription" feature returns to the client's library.
    """
    import io
    from music21 import converter
    from music21.musicxml.m21ToXml import GeneralObjectExporter

    score = converter.parse(io.BytesIO(midi_bytes), format="midi")
    # Render MusicXML to a string via the exporter (music21's write() wants a path).
    return GeneralObjectExporter(score).parse().decode("utf-8")
