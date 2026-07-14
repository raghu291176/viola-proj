"""One recording -> real analysis -> persisted feedback.

This is the body of the AKS worker (§3.7 steps 7-9). It is written for real
infrastructure; the only things that require the cloud are the actual Blob
Storage / Service Bus / PostgreSQL / Web PubSub endpoints (from env). The model
inference itself runs anywhere the worker image runs, including a laptop CPU.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models.feedback import analyze
from .models import matching
from .models.transcribe import transcribe, transcription_to_musicxml


@dataclass
class AnalyzeJob:
    recording_id: str
    user_id: str
    blob_url: str                 # the uploaded WAV
    kind: str                     # "feedback" | "transcription" | "omr"
    skill: str = "reading"
    level: str = "intermediate"   # judging strictness (ARCHITECTURE.md §4.4)
    ref_a: float = 442.0          # reference pitch A4 (orchestral players use 442/443)
    reference_blob_url: str | None = None  # reference score (MusicXML), when available


def _download(blob_url: str, dest: Path) -> None:
    """Download a blob to a local path using the worker's managed identity."""
    from azure.storage.blob import BlobClient
    from azure.identity import DefaultAzureCredential

    client = BlobClient.from_blob_url(blob_url, credential=DefaultAzureCredential())
    with open(dest, "wb") as f:
        f.write(client.download_blob().readall())


def run(job: AnalyzeJob, conn) -> dict[str, Any]:
    """Execute a job end to end and write results under the user's RLS context.

    `conn` is a psycopg/asyncpg-style connection already opened by the worker.
    """
    with tempfile.TemporaryDirectory() as d:
        audio = Path(d) / "recording.wav"
        _download(job.blob_url, audio)

        ref_musicxml: str | None = None
        if job.reference_blob_url:
            ref_path = Path(d) / "reference.musicxml"
            _download(job.reference_blob_url, ref_path)
            ref_musicxml = ref_path.read_text(encoding="utf-8")

        if job.kind == "transcription":
            tr = transcribe(audio)
            musicxml = transcription_to_musicxml(tr.midi_bytes)
            result = {"type": "transcription", **tr.summary(), "musicxml_len": len(musicxml)}
            _persist_transcription(conn, job, musicxml)
        elif job.kind == "omr":
            from .models.omr import to_musicxml
            musicxml = to_musicxml(audio)   # `audio` here is the uploaded PDF/image blob
            result = {"type": "omr", "musicxml_len": len(musicxml)}
            _persist_transcription(conn, job, musicxml)
        else:
            # Aggregate technique feedback (strengths/work) …
            fb = analyze(audio, skill=job.skill)
            # … plus per-note sheet-vs-audio matching when a reference score exists.
            note_verdicts: list[dict[str, Any]] = []
            score = fb.score
            if ref_musicxml:
                m = matching.analyze(audio, ref_musicxml, level=job.level, ref_a=job.ref_a)
                note_verdicts = m["note_verdicts"]
                if m["total"]:
                    score = m["score"]   # match score is the authoritative number when we have a score
            result = {"type": "feedback", **fb.to_dict(), "score": score, "note_verdicts": note_verdicts}
            _persist_feedback(conn, job, fb, score, note_verdicts)

    return result


# --- persistence (RLS-scoped) ----------------------------------------------

def _set_user(conn, user_id: str) -> None:
    # Re-establish the tenant context in the async worker (outside any request).
    conn.execute("SELECT set_config('app.current_user_id', %s, true)", (user_id,))


def _persist_feedback(conn, job: AnalyzeJob, fb, score: int, note_verdicts: list[dict[str, Any]]) -> None:
    _set_user(conn, job.user_id)
    conn.execute(
        """
        INSERT INTO ai_feedback (recording_id, user_id, score, strengths, work, metrics, note_verdicts)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (job.recording_id, job.user_id, score, fb.strengths, fb.work, _json(fb.metrics), _json(note_verdicts)),
    )
    conn.execute(
        "UPDATE recordings SET status = 'completed' WHERE id = %s AND user_id = %s",
        (job.recording_id, job.user_id),
    )


def _persist_transcription(conn, job: AnalyzeJob, musicxml: str) -> None:
    _set_user(conn, job.user_id)
    conn.execute(
        "UPDATE recordings SET status = 'completed', musicxml = %s WHERE id = %s AND user_id = %s",
        (musicxml, job.recording_id, job.user_id),
    )


def _json(obj: Any) -> str:
    import json
    return json.dumps(obj)
