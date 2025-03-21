from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import QueuePool

from models import Base

_main_uri = "postgres:postgres@localhost:5432/postgres"
_sync_uri = f"postgresql://{_main_uri}"
_async_uri = f"postgresql+asyncpg://{_main_uri}"

sync_engine = create_engine(
    _sync_uri,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_pre_ping=True
)

Base.metadata.create_all(sync_engine)

engine = create_async_engine(
    _async_uri,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_pre_ping=True,
    echo=False
)
