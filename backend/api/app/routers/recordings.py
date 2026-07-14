"""Recording upload + analysis API (ARCHITECTURE.md §3.7 steps 1-5, 9).

    POST /recordings/upload-uri     -> mint SAS, create pending recording
    POST /recordings/{id}/analyze   -> enqueue analysis, 202 Accepted
    GET  /recordings/{id}           -> status + feedback (PubSub is the primary channel)
    GET  /recordings/{id}/subscribe -> Web PubSub client access token for this user's group
"""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from ..auth import current_user
from ..db import user_tx
from ..storage import mint_upload_sas
from ..bus import publish_analyze
from ..config import settings

router = APIRouter(prefix="/recordings", tags=["recordings"])


class UploadUriRequest(BaseModel):
    kind: Literal["feedback", "transcription"] = "feedback"
    skill: str = "reading"
    lesson_id: str | None = None


class AnalyzeRequest(BaseModel):
    blob_url: str
    kind: Literal["feedback", "transcription"] = "feedback"
    skill: str = "reading"
    reference_blob_url: str | None = None


@router.post("/upload-uri", status_code=201)
async def upload_uri(body: UploadUriRequest, user: str = Depends(current_user)) -> dict:
    recording_id = str(uuid.uuid4())
    async with user_tx(user) as conn:
        await conn.execute(
            """INSERT INTO recordings (id, user_id, kind, skill, lesson_id, status)
               VALUES ($1, $2, $3, $4, $5, 'pending')""",
            recording_id, user, body.kind, body.skill, body.lesson_id,
        )
    return mint_upload_sas(user, recording_id)


@router.post("/{recording_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def analyze(recording_id: str, body: AnalyzeRequest, user: str = Depends(current_user)) -> dict:
    async with user_tx(user) as conn:
        row = await conn.fetchrow(
            "SELECT id FROM recordings WHERE id = $1 AND user_id = $2", recording_id, user
        )
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
        await conn.execute(
            "UPDATE recordings SET status = 'processing', blob_url = $2 WHERE id = $1",
            recording_id, body.blob_url,
        )
    publish_analyze({
        "recording_id": recording_id,
        "user_id": user,
        "blob_url": body.blob_url,
        "kind": body.kind,
        "skill": body.skill,
        "reference_blob_url": body.reference_blob_url,
    })
    return {"recording_id": recording_id, "status": "processing"}


@router.get("/{recording_id}")
async def get_recording(recording_id: str, user: str = Depends(current_user)) -> dict:
    async with user_tx(user) as conn:
        rec = await conn.fetchrow(
            "SELECT id, status, kind, skill FROM recordings WHERE id = $1 AND user_id = $2",
            recording_id, user,
        )
        if not rec:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "recording not found")
        fb = await conn.fetchrow(
            "SELECT score, strengths, work, metrics FROM ai_feedback WHERE recording_id = $1",
            recording_id,
        )
    out = {"recording_id": rec["id"], "status": rec["status"], "kind": rec["kind"], "skill": rec["skill"]}
    if fb:
        out["feedback"] = {"score": fb["score"], "strengths": list(fb["strengths"]),
                           "work": list(fb["work"]), "metrics": fb["metrics"]}
    return out


@router.get("/{recording_id}/subscribe")
async def subscribe(recording_id: str, user: str = Depends(current_user)) -> dict:
    """Return a Web PubSub client access URL scoped to this user's group."""
    cfg = settings()
    if not cfg.webpubsub_endpoint:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Web PubSub not configured")
    from azure.identity import DefaultAzureCredential
    from azure.messaging.webpubsubservice import WebPubSubServiceClient

    client = WebPubSubServiceClient(
        endpoint=cfg.webpubsub_endpoint, hub=cfg.webpubsub_hub, credential=DefaultAzureCredential()
    )
    token = client.get_client_access_token(user_id=user, groups=[f"user:{user}"], roles=[
        f"webpubsub.joinLeaveGroup.user:{user}", f"webpubsub.sendToGroup.user:{user}"
    ])
    return {"url": token["url"]}
