"""Registration + login. Self-contained email/password auth issuing JWTs that
carry the user's role — this is what onboards teachers (ARCHITECTURE.md §3.3)."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

from ..auth import create_access_token, current_user
from ..db import conn, user_tx

router = APIRouter(prefix="/auth", tags=["auth"])
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    role: Literal["student", "teacher"] = "student"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    name: str
    role: str


@router.post("/register", status_code=201, response_model=AuthResponse)
async def register(body: RegisterRequest) -> AuthResponse:
    pw_hash = _pwd.hash(body.password)
    async with conn() as c:
        try:
            uid = await c.fetchval(
                "SELECT app_register($1, $2, $3, $4)", body.email, pw_hash, body.name, body.role
            )
        except Exception as exc:  # unique-violation etc.
            raise HTTPException(status.HTTP_409_CONFLICT, "email already registered") from exc
    return AuthResponse(token=create_access_token(uid, body.role), user_id=str(uid), name=body.name, role=body.role)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest) -> AuthResponse:
    async with conn() as c:
        row = await c.fetchrow("SELECT * FROM app_login_lookup($1)", body.email)
    if not row or not row["password_hash"] or not _pwd.verify(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    uid, role, name = str(row["id"]), row["role"], row["name"]
    return AuthResponse(token=create_access_token(uid, role), user_id=uid, name=name, role=role)


@router.get("/me")
async def me(user: str = Depends(current_user)) -> dict:
    async with user_tx(user) as c:
        row = await c.fetchrow("SELECT id, email, name, role, plan FROM users WHERE id = $1", user)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return {"user_id": str(row["id"]), "email": row["email"], "name": row["name"],
            "role": row["role"], "plan": row["plan"]}
