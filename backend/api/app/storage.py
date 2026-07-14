"""Direct-to-blob uploads via short-lived, write-only SAS tokens (§3.5, §3.7 step 2).

Tokens are minted from a **User Delegation Key** (AAD-backed, not the account
key), scoped to a single blob, write/create only, 15-minute TTL. The API never
proxies the audio and never holds a long-lived storage key.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, BlobSasPermissions, generate_blob_sas

from .config import settings

_SAS_TTL = timedelta(minutes=15)


def _account_url(account: str) -> str:
    return f"https://{account}.blob.core.windows.net"


def mint_upload_sas(user_id: str, recording_id: str) -> dict[str, str]:
    cfg = settings()
    account_url = _account_url(cfg.storage_account)
    svc = BlobServiceClient(account_url, credential=DefaultAzureCredential())

    start = datetime.now(timezone.utc)
    expiry = start + _SAS_TTL
    udk = svc.get_user_delegation_key(key_start_time=start, key_expiry_time=expiry)

    blob_name = f"{user_id}/{recording_id}.wav"
    sas = generate_blob_sas(
        account_name=cfg.storage_account,
        container_name=cfg.storage_container,
        blob_name=blob_name,
        user_delegation_key=udk,
        permission=BlobSasPermissions(write=True, create=True),  # write-only
        start=start,
        expiry=expiry,
    )
    blob_url = f"{account_url}/{cfg.storage_container}/{blob_name}"
    return {
        "recording_id": recording_id,
        "upload_url": f"{blob_url}?{sas}",   # client PUTs the WAV here
        "blob_url": blob_url,                # returned back on /analyze
        "expires_at": expiry.isoformat(),
    }
