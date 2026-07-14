"""ViolaHub API — FastAPI core behind Azure API Management (ARCHITECTURE.md §3.3)."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import open_pool, close_pool
from .routers import recordings, auth, assessments


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await open_pool()
    try:
        yield
    finally:
        await close_pool()


app = FastAPI(title="ViolaHub API", version="0.1.0", lifespan=lifespan)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(recordings.router, prefix="/api/v1")
app.include_router(assessments.router, prefix="/api/v1")


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
