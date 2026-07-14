"""Publish analyze jobs to the Service Bus topic (§3.7 step 5).

`session_id = user_id` keeps a user's jobs ordered and lets KEDA scale on the
topic's queue depth.
"""
from __future__ import annotations

import json

from azure.identity import DefaultAzureCredential
from azure.servicebus import ServiceBusClient, ServiceBusMessage

from .config import settings


# Classify a job to a GPU pool (ARCHITECTURE.md §4.2): heavy DL → A10G/A100 pool,
# everything else → T4 pool. Each pool drains its own topic via its own KEDA scaler.
_HEAVY_KINDS = {"transcription", "omr"}


def topic_for(kind: str) -> str:
    cfg = settings()
    return cfg.servicebus_topic_heavy if kind in _HEAVY_KINDS else cfg.servicebus_topic


def publish_analyze(payload: dict) -> None:
    cfg = settings()
    topic = topic_for(payload.get("kind", "feedback"))
    with ServiceBusClient(cfg.servicebus_namespace, DefaultAzureCredential()) as sb:
        with sb.get_topic_sender(topic) as sender:
            sender.send_messages(
                ServiceBusMessage(json.dumps(payload), session_id=payload["user_id"])
            )
