# ViolaHub backend

Multi-user backend for ViolaHub. Implements the architecture in
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — the FastAPI core, the
PostgreSQL schema with Row-Level Security, and the **real** AI analysis pipeline
(§3.7).

> **The AI is real, not faked.** Transcription runs Spotify **basic-pitch**
> (pretrained ICASSP-2022 model). Feedback runs real DSP analysis (**librosa** /
> **music21**): intonation in cents, rhythm/tempo stability, tone (RMS + spectral
> centroid), and chroma-DTW note matching against a reference score. Weights are
> baked into the worker image at build time and warmed by a real inference pass —
> a broken image never ships.

## Layout

```
backend/
├── api/                    # FastAPI core (request-light, no model deps)
│   ├── app/
│   │   ├── main.py         # app + lifespan (opens asyncpg pool)
│   │   ├── config.py       # env settings
│   │   ├── db.py           # asyncpg pool + per-request RLS tx (app.current_user_id)
│   │   ├── auth.py         # bearer JWT -> user_id (JWKS in prod, HS dev)
│   │   ├── storage.py      # 15-min write-only SAS from User Delegation Keys
│   │   ├── bus.py          # publish analyze jobs to Service Bus
│   │   └── routers/recordings.py   # §3.7 steps 1-5, 9
│   ├── Dockerfile
│   └── requirements.txt
├── worker/                 # AKS GPU worker (real model inference)
│   ├── worker/
│   │   ├── main.py         # Service Bus consumer loop + Web PubSub notify
│   │   ├── pipeline.py     # download blob -> analyze -> persist (RLS)
│   │   ├── fetch_models.py # bakes + warms weights at build time
│   │   ├── models/transcribe.py   # basic-pitch audio -> MIDI/MusicXML
│   │   ├── models/feedback.py     # librosa/music21 real scoring
│   │   └── scripts/local_analyze.py  # run the models on a local WAV, no cloud
│   ├── Dockerfile          # real pip installs + `RUN python -m worker.fetch_models`
│   └── requirements.txt
├── db/
│   ├── schema.sql          # tables
│   └── rls.sql             # Row-Level Security policies
└── docker-compose.yml      # local Postgres + API
```

## What runs where

| Concern | Where | Real today? |
| --- | --- | --- |
| API, SAS minting, job enqueue | FastAPI (`api/`) | ✅ code is real; needs Azure Storage/Service Bus endpoints to mint/publish |
| Auth | `auth.py` | ✅ real JWT validation (point `VIOLAHUB_JWT_JWKS_URL` at your IdP) |
| DB + tenant isolation | PostgreSQL + `rls.sql` | ✅ fully real |
| Transcription (audio→notation) | `worker/models/transcribe.py` | ✅ real pretrained model, runs on CPU |
| Technique feedback | `worker/models/feedback.py` | ✅ real DSP, runs on CPU |
| GPU acceleration / autoscale | AKS + KEDA | build/deploy step (swap `onnxruntime`→`onnxruntime-gpu`) |
| Registering models in Azure ML | optional | "upgradeable later" — same math, served via AML Managed Online Endpoints |

## Run the models locally (no cloud, CPU)

```bash
cd backend/worker
pip install -r requirements.txt
# feedback on a recording of you playing:
python -m worker.scripts.local_analyze /path/to/recording.wav --skill bow
# transcription (audio -> notation):
python -m worker.scripts.local_analyze /path/to/song.wav --transcribe
```

## Benchmark MIR accuracy

A pro-grade tool publishes its accuracy. `worker/scripts/benchmark.py` measures our
pitch + note detection against ground truth with the standard `mir_eval` metrics.

```bash
cd worker && . .venv/bin/activate && pip install mir_eval
# Self-test on synthetic audio (known f0/notes) — validates the harness, gives a baseline:
python -m scripts.benchmark
# Real corpus — URMP violin/viola/cello stems (download separately; CC-BY-NC → internal use):
python -m scripts.benchmark --urmp /path/to/URMP/Dataset
# Compare detectors as we add them (pyin today → CREPE/PESTO):
python -m scripts.benchmark --detector pyin
```

Reports Raw Pitch/Chroma Accuracy, voicing recall/false-alarm, **mean/median |cents
error|** (bounds intonation-feedback precision), and note/onset P/R/F (false-positive
rate = 1 − precision).

> **Honest caveat:** the synthetic self-test is clean audio → optimistic (RPA ≈ 0.96,
> median cents ≈ 3.5). Real recordings (bow noise, room, string crossings, double
> stops) score lower — that's what the `--urmp` path is for. Run it on URMP before
> quoting an accuracy number externally.

## Run the API + DB locally

```bash
cd backend
docker compose up --build        # Postgres (schema+RLS applied) + API on :8000
# health:
curl localhost:8000/healthz
```

Mint a dev JWT (HS256, `sub` = a users.id UUID) to call authed endpoints:

```python
from jose import jwt
print(jwt.encode({"sub": "<user-uuid>", "aud": "violahub"}, "dev-only-change-me", algorithm="HS256"))
```

## Build the images

```bash
docker build -t violahub-api    ./api
docker build -t violahub-worker ./worker   # runs fetch_models at build → weights baked in
```

## Client contract (replaces the prototype's simulated `stopRecording`)

1. `POST /api/v1/recordings/upload-uri {kind, skill}` → `{recording_id, upload_url, blob_url}`
2. `PUT` the WAV to `upload_url` (direct to Blob, SAS)
3. `POST /api/v1/recordings/{id}/analyze {blob_url, kind, skill}` → `202`, set `recState:'analyzing'`
4. `GET /api/v1/recordings/{id}/subscribe` → Web PubSub URL; on the `completed`
   event, populate `feedback` and set `recState:'done'`. (`GET /recordings/{id}`
   is the polling fallback.) The screen UI is unchanged.
