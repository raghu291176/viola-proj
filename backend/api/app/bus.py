"""Publish analyze jobs to the Service Bus topic (§3.7 step 5).

`session_id = user_id` keeps a user's jobs ordered and lets KEDA scale on the
topic's queue depth.
"""
from __future__ import annotations

import json

from azure.identity import DefaultAzureCredential
from azure.servicebus import ServiceBusClient, ServiceBusMessage

from .config import settings


def publish_analyze(payload: dict) -> None:
    cfg = settings()
    with ServiceBusClient(cfg.servicebus_namespace, DefaultAzureCredential()) as sb:
        with sb.get_topic_sender(cfg.servicebus_topic) as sender:
            sender.send_messages(
                ServiceBusMessage(json.dumps(payload), session_id=payload["user_id"])
            )
