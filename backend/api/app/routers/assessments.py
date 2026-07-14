"""Teacher assessments — the labeled-data sink for the technique moat.

Teacher-only. Each POST is a labeled training record (student technique grades +
the recording + consent), RLS-scoped to the assessing teacher.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..auth import require_teacher, Principal
from ..db import user_tx

router = APIRouter(prefix="/assessments", tags=["assessments"])


class AssessmentIn(BaseModel):
    student: str = Field(min_length=1, max_length=120)
    level: str = "Intermediate"
    piece_title: str = ""
    grades: dict[str, int] = {}
    notes: str = ""
    consent: bool
    recording_id: str | None = None


@router.post("", status_code=201)
async def create(body: AssessmentIn, teacher: Principal = Depends(require_teacher)) -> dict:
    if not body.consent:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "consent is required to store a recording")
    async with user_tx(teacher.id) as c:
        aid = await c.fetchval(
            """INSERT INTO assessments
                 (teacher_id, student_name, level, piece_title, recording_id, grades, notes, consent)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            teacher.id, body.student, body.level, body.piece_title, body.recording_id,
            json.dumps(body.grades), body.notes, body.consent,
        )
    return {"assessment_id": str(aid)}


@router.get("")
async def list_mine(teacher: Principal = Depends(require_teacher)) -> list[dict]:
    async with user_tx(teacher.id) as c:
        rows = await c.fetch(
            """SELECT id, student_name, level, piece_title, grades, notes, consent, created_at
                 FROM assessments ORDER BY created_at DESC LIMIT 500""")
    return [
        {"id": str(r["id"]), "student": r["student_name"], "level": r["level"],
         "piece_title": r["piece_title"], "grades": r["grades"], "notes": r["notes"],
         "consent": r["consent"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]
