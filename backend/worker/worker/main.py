"""AKS GPU worker entrypoint (§3.7 steps 6-9).

Consumes analyze jobs from a Service Bus topic subscription, runs the real model
pipeline, persists results under the job's RLS user context, and pushes a
completion event to Azure Web PubSub so the client's `recState` flips to `done`
without polling. KEDA scales the number of these workers on queue depth.
"""
from __future__ import annotations

import json
import os

import psycopg

from .pipeline import AnalyzeJob, run


def _connect_db() -> "psycopg.Connection":
    return psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)


def _notify(user_id: str, payload: dict) -> None:
    """Push a completion event to the user's Web PubSub group."""
    from azure.messaging.webpubsubservice import WebPubSubServiceClient
    from azure.identity import DefaultAzureCredential

    endpoint = os.environ.get("WEBPUBSUB_ENDPOINT")
    if not endpoint:
        print(f"[worker] (no WEBPUBSUB_ENDPOINT) would notify {user_id}: {payload}")
        return
    client = WebPubSubServiceClient(endpoint=endpoint, hub="violahub", credential=DefaultAzureCredential())
    client.send_to_group(group=f"user:{user_id}", message=json.dumps(payload), content_type="application/json")


def handle(raw: str, conn) -> None:
    msg = json.loads(raw)
    job = AnalyzeJob(
        recording_id=msg["recording_id"],
        user_id=msg["user_id"],
        blob_url=msg["blob_url"],
        kind=msg.get("kind", "feedback"),
        skill=msg.get("skill", "reading"),
        level=msg.get("level", "intermediate"),
        reference_blob_url=msg.get("reference_blob_url"),
    )
    print(f"[worker] analyzing recording {job.recording_id} ({job.kind}/{job.skill}) for {job.user_id}")
    result = run(job, conn)
    _notify(job.user_id, {"recording_id": job.recording_id, "status": "completed", "result": result})
    print(f"[worker] done recording {job.recording_id}: score={result.get('score')}")


def main() -> None:
    from azure.servicebus import ServiceBusClient
    from azure.identity import DefaultAzureCredential

    namespace = os.environ["SERVICEBUS_NAMESPACE"]           # e.g. violahub.servicebus.windows.net
    topic = os.environ.get("SERVICEBUS_TOPIC", "recordings")
    subscription = os.environ.get("SERVICEBUS_SUBSCRIPTION", "workers")

    conn = _connect_db()
    sb = ServiceBusClient(namespace, DefaultAzureCredential())
    with sb, sb.get_subscription_receiver(topic, subscription, max_wait_time=30) as receiver:
        print("[worker] listening for jobs...")
        for message in receiver:                              # blocks; KEDA scales replicas
            try:
                handle(str(message), conn)
                receiver.complete_message(message)
            except Exception as exc:                          # noqa: BLE001 — dead-letter on failure
                print(f"[worker] job failed: {exc}")
                receiver.dead_letter_message(message, reason="analysis_failed", error_description=str(exc))


if __name__ == "__main__":
    main()
