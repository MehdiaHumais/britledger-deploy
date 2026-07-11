from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

_is_sqlite = "sqlite" in settings.database_url

if not _is_sqlite:
    import asyncpg as _asyncpg
    _original_asyncpg_connect = _asyncpg.connect
    async def _asyncpg_connect_stmt_cache(*args, **kwargs):
        kwargs.setdefault("statement_cache_size", 0)
        return await _original_asyncpg_connect(*args, **kwargs)
    _asyncpg.connect = _asyncpg_connect_stmt_cache

connect_args = {"check_same_thread": False} if _is_sqlite else {"prepared_statement_cache_size": 0}
poolclass = None if _is_sqlite else NullPool

engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,
    connect_args=connect_args,
    poolclass=poolclass,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
