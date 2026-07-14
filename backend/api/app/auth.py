"""Auth — token issuance + validation, roles.

Self-issued HS256 tokens (email/password login below) work standalone for the
teacher rollout. Prod can additionally validate RS256 tokens from an IdP's JWKS
(set VIOLAHUB_JWT_JWKS_URL) — e.g. Azure Entra External ID. The `sub` claim is
the user id; `role` is student|teacher|admin.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from .config import settings

_bearer = HTTPBearer(auto_error=True)
_TOKEN_TTL = timedelta(days=30)


@dataclass
class Principal:
    id: str
    role: str


def create_access_token(user_id: str, role: str) -> str:
    cfg = settings()
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id), "role": role, "aud": cfg.jwt_audience,
        "iat": now, "exp": now + _TOKEN_TTL,
    }
    return jwt.encode(claims, cfg.jwt_dev_secret, algorithm="HS256")


def _decode(token: str) -> dict:
    cfg = settings()
    try:
        if cfg.jwt_jwks_url:
            from jose import jwk
            import urllib.request, json
            jwks = json.loads(urllib.request.urlopen(cfg.jwt_jwks_url).read())
            header = jwt.get_unverified_header(token)
            key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
            return jwt.decode(
                token, jwk.construct(key).to_pem().decode(),
                algorithms=["RS256"], audience=cfg.jwt_audience, issuer=cfg.jwt_issuer or None,
            )
        return jwt.decode(token, cfg.jwt_dev_secret, algorithms=["HS256"], audience=cfg.jwt_audience)
    except (JWTError, StopIteration, KeyError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}") from exc


def current_principal(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> Principal:
    claims = _decode(creds.credentials)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing sub")
    return Principal(id=str(sub), role=str(claims.get("role", "student")))


def current_user(p: Principal = Depends(current_principal)) -> str:
    """Back-compat: routes that only need the user id."""
    return p.id


def require_teacher(p: Principal = Depends(current_principal)) -> Principal:
    if p.role not in ("teacher", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "teacher role required")
    return p
