"""Bearer-token auth -> user_id.

Prod: validate an RS256 JWT against the IdP's JWKS (set VIOLAHUB_JWT_JWKS_URL).
Dev:  if no JWKS is configured, accept an HS256 token signed with the dev secret
      so the stack runs end to end locally. The `sub` claim is the user id.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from .config import settings

_bearer = HTTPBearer(auto_error=True)


def current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> str:
    cfg = settings()
    token = creds.credentials
    try:
        if cfg.jwt_jwks_url:
            from jose import jwk
            import urllib.request, json
            jwks = json.loads(urllib.request.urlopen(cfg.jwt_jwks_url).read())
            header = jwt.get_unverified_header(token)
            key = next(k for k in jwks["keys"] if k["kid"] == header["kid"])
            claims = jwt.decode(
                token, jwk.construct(key).to_pem().decode(),
                algorithms=["RS256"], audience=cfg.jwt_audience, issuer=cfg.jwt_issuer or None,
            )
        else:  # dev
            claims = jwt.decode(token, cfg.jwt_dev_secret, algorithms=["HS256"], audience=cfg.jwt_audience)
    except (JWTError, StopIteration, KeyError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}") from exc

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing sub")
    return str(sub)
