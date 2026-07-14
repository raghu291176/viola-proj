# ViolaHub analysis worker — real model inference.
# CPU base by default (runs anywhere). For the AKS T4 pool, switch the base image
# to an ONNX Runtime CUDA image and pin onnxruntime-gpu in requirements.txt — the
# model code and this Dockerfile are otherwise identical.
FROM python:3.11-slim

# System deps for audio I/O (soundfile -> libsndfile, librosa -> ffmpeg).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the REAL model + DSP stack. This pulls basic-pitch (with its bundled
# ICASSP-2022 ONNX weights), librosa, music21, pretty_midi, and the Azure clients.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ ./worker/

# Bake + warm the pretrained weights into the image (real inference pass at build
# time). Build fails here if the model can't load or run — a broken image never ships.
RUN python -m worker.fetch_models

# KEDA scales replicas of this on Service Bus queue depth.
CMD ["python", "-m", "worker.main"]
