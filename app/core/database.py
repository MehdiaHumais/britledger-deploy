from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

from sqlalchemy.pool import NullPool

_is_sqlite = "sqlite" in settings.database_url

if _is_sqlite:
    connect_args = {"check_same_thread": False}
    poolclass = None
else:
    connect_args = {
        "statement_cache_size": 0,
    }
    poolclass = NullPool

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
