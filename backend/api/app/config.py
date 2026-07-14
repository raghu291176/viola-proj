"""API configuration from environment (12-factor)."""
from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VIOLAHUB_", env_file=".env", extra="ignore")

    database_url: str = "postgresql://violahub:violahub@localhost:5432/violahub"

    storage_account: str = "violahub"
    storage_container: str = "recordings"

    servicebus_namespace: str = "violahub.servicebus.windows.net"
    servicebus_topic: str = "recordings"

    webpubsub_endpoint: str = ""            # e.g. https://violahub.webpubsub.azure.com
    webpubsub_hub: str = "violahub"

    # Auth — configure a real IdP's JWKS in prod (RS256). HS secret is dev-only.
    jwt_jwks_url: str = ""
    jwt_audience: str = "violahub"
    jwt_issuer: str = ""
    jwt_dev_secret: str = "dev-only-change-me"


@lru_cache
def settings() -> Settings:
    return Settings()
