"""
Async Database Session Factory
===============================

Provides async SQLAlchemy engine and session maker
for use with FastAPI dependency injection.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)

from casino.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Engine & Session Factory
# ---------------------------------------------------------------------------

engine: AsyncEngine = create_async_engine(
    settings.database.url,
    pool_size=settings.database.pool_size,
    max_overflow=settings.database.max_overflow,
    echo=settings.database.echo,
    pool_pre_ping=True,       # detect stale connections
    pool_recycle=1800,         # recycle connections every 30 min
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# Lifecycle helpers (called from FastAPI lifespan)
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Verify connectivity on startup (tables managed by Alembic)."""
    async with engine.begin() as conn:
        # quick connectivity check
        await conn.execute(
            __import__("sqlalchemy").text("SELECT 1")
        )


async def close_db() -> None:
    """Dispose of the connection pool on shutdown."""
    await engine.dispose()
