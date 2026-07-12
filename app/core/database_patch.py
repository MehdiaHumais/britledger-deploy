"""Apply statement_cache_size=0 to asyncpg.connect for pgbouncer compatibility.

This module must be imported before any database engine is created,
so the monkey-patch is active when asyncpg.connect is first called.
"""
import os

# Only patch for asyncpg (not SQLite)
_use_asyncpg = "sqlite" not in os.environ.get("SUPABASE_DATABASE_URL", "")

if _use_asyncpg:
    import asyncpg as _asyncpg

    _original_connect = _asyncpg.connect

    async def _patched_connect(dsn=None, *args, **kwargs):
        kwargs.setdefault("statement_cache_size", 0)
        return await _original_connect(dsn, *args, **kwargs)

    _asyncpg.connect = _patched_connect
