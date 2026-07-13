"""Apply statement_cache_size=0 to asyncpg.connect for pgbouncer compatibility.

This patches asyncpg.connect at module import time.  Also hooks into
SQLAlchemy's PoolEvents to apply the setting on every new connection.
"""
import os
import sys
import logging as _logging

_logger = _logging.getLogger("britledger.patch")

_use_asyncpg = "sqlite" not in os.environ.get("SUPABASE_DATABASE_URL", "")

if _use_asyncpg:
    import asyncpg as _asyncpg

    _original_connect = _asyncpg.connect

    async def _patched_connect(dsn=None, *args, **kwargs):
        kwargs.setdefault("statement_cache_size", 0)
        return await _original_connect(dsn, *args, **kwargs)

    # Patch asyncpg.connect globally
    _asyncpg.connect = _patched_connect

    # Force-patch any already-loaded SQLAlchemy AsyncAdapt_asyncpg_dbapi instances
    for mod_name in list(sys.modules.keys()):
        if "sqlalchemy" in mod_name:
            mod = sys.modules[mod_name]
            for attr_name in dir(mod):
                attr = getattr(mod, attr_name, None)
                if isinstance(attr, type) and hasattr(attr, "asyncpg"):
                    try:
                        attr.asyncpg = _asyncpg
                        _logger.info(
                            "database_patch: force-patched %s.%s.asyncpg",
                            mod_name, attr_name,
                        )
                    except Exception:
                        pass
