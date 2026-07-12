from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Must be imported before engine creation to patch asyncpg.connect
from app.core import database_patch  # noqa: F401

_is_sqlite = "sqlite" in settings.database_url

connect_args = {"check_same_thread": False} if _is_sqlite else {}
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
