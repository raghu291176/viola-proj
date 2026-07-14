"""Async PostgreSQL access with per-request Row-Level Security context.

Every query runs inside a transaction that first sets `app.current_user_id`, so
RLS policies (see db/rls.sql) confine the connection to that user's rows — the
authorization backstop described in ARCHITECTURE.md §3.3.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import asyncpg

from .config import settings

_pool: asyncpg.Pool | None = None


async def open_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(settings().database_url, min_size=1, max_size=10)


async def close_pool() -> None:
    if _pool:
        await _pool.close()


@asynccontextmanager
async def user_tx(user_id: str) -> AsyncIterator[asyncpg.Connection]:
    """Yield a connection bound to `user_id` via RLS, inside a transaction."""
    assert _pool is not None, "pool not initialised"
    async with _pool.acquire() as conn:
        async with conn.transaction():
            # `true` => LOCAL to this transaction only.
            await conn.execute("SELECT set_config('app.current_user_id', $1, true)", user_id)
            yield conn
