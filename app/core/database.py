from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import event

from app.core.config import settings

from sqlalchemy.pool import NullPool

_is_sqlite = "sqlite" in settings.database_url

connect_args = {"check_same_thread": False} if _is_sqlite else {}
poolclass = None if _is_sqlite else NullPool

engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,
    connect_args=connect_args,
    poolclass=poolclass,
)

if not _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def disable_prepared_statements(dbapi_connection, connection_record):
        dbapi_connection.driver_connection.set_statement_cache_size(0)

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
