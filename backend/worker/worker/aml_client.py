"""Thin-orchestrator mode (ARCHITECTURE.md §4.5).

When an AML Managed Online Endpoint is configured, the worker calls it instead of
running inference in-pod — identical model, different hosting. If the env vars are
unset, callers fall back to local inference (models baked into the image).
"""
from __future__ import annotations

import base64
import json
import os
import urllib.request
from pathlib import Path
from typing import Any


def _call(url: str, key: str, payload: dict[str, Any]) -> dict[str, Any]:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310 — trusted AML endpoint
        return json.loads(resp.read())


def transcribe_via_aml(audio_path: str | Path) -> dict[str, Any] | None:
    """Return AML transcription result, or None if no endpoint is configured."""
    url, key = os.environ.get("AML_TRANSCRIBE_ENDPOINT"), os.environ.get("AML_TRANSCRIBE_KEY")
    if not url or not key:
        return None
    b64 = base64.b64encode(Path(audio_path).read_bytes()).decode()
    return _call(url, key, {"audio_b64": b64})


def omr_via_aml(image_path: str | Path) -> dict[str, Any] | None:
    url, key = os.environ.get("AML_OMR_ENDPOINT"), os.environ.get("AML_OMR_KEY")
    if not url or not key:
        return None
    b64 = base64.b64encode(Path(image_path).read_bytes()).decode()
    return _call(url, key, {"audio_b64": b64})
