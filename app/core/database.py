from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

_is_sqlite = "sqlite" in settings.database_url

connect_args = (
    {"check_same_thread": False}
    if _is_sqlite
    else {"statement_cache_size": 0}
)

pool_kwargs = {}
if not _is_sqlite:
    # Persistent pool for Postgres: reusing connections avoids the slow
    # per-request connection handshake to the remote database.
    pool_kwargs = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }

engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,
    connect_args=connect_args,
    **pool_kwargs,
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
