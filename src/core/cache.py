"""Cache layer: stores Schwab API responses in Neon PostgreSQL.

Avoids hitting Schwab rate limits (120 req/min).
TTL-based invalidation. Matches the data_vault pattern from SchwabAPI project.
"""

import logging
import json
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import Column, String, Text, DateTime, select, delete
from sqlalchemy.orm import declarative_base, sessionmaker

from src.config import DATABASE_URL, CACHE_TTL_DEFAULT, CACHE_TTL_FUNDAMENTALS, CACHE_TTL_PRICE_HISTORY

logger = logging.getLogger(__name__)

Base = declarative_base()


def _async_url(url: str) -> str:
    """Convert a sync DB URL to its async driver equivalent.

    Local dev uses sqlite (needs aiosqlite); production uses PostgreSQL
    (needs asyncpg, not the default sync psycopg2 driver).
    """
    if url.startswith("sqlite"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class CacheEntry(Base):
    """Cache entry for API responses."""

    __tablename__ = "cache_entries"

    key = Column(String(255), primary_key=True)
    value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, default=datetime.utcnow)
    data_type = Column(String(50))


engine = create_async_engine(_async_url(DATABASE_URL))
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def make_cache_key(endpoint: str, params: dict) -> str:
    """Generate a deterministic cache key from endpoint + params."""
    param_str = json.dumps(params, sort_keys=True)
    return f"{endpoint}:{hashlib.md5(param_str.encode()).hexdigest()}"


async def init_db():
    """Create tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized.")


async def get_cached(key: str, ttl: int = None) -> dict | None:
    """Retrieve a cached value if not expired."""
    ttl_seconds = ttl or CACHE_TTL_DEFAULT
    cutoff = datetime.utcnow()

    async with AsyncSessionLocal() as session:
        stmt = select(CacheEntry).where(CacheEntry.key == key)
        result = await session.execute(stmt)
        entry = result.scalar_one_or_none()

        if entry and entry.expires_at > cutoff:
            try:
                return json.loads(entry.value)
            except json.JSONDecodeError:
                logger.warning(f"Cache corruption for key: {key}")
                return None

        # Delete expired entry
        if entry:
            await session.delete(entry)
            await session.commit()

        return None


async def set_cached(key: str, value: dict, data_type: str = "generic", ttl: int = None):
    """Store a value in cache with TTL."""
    ttl_seconds = ttl or CACHE_TTL_DEFAULT
    expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)

    async with AsyncSessionLocal() as session:
        entry = CacheEntry(
            key=key,
            value=json.dumps(value),
            data_type=data_type,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
        )
        await session.merge(entry)
        await session.commit()
        logger.debug(f"Cached key: {key} (type: {data_type}, ttl: {ttl_seconds}s)")


async def clear_expired():
    """Remove all expired cache entries."""
    cutoff = datetime.utcnow()
    async with AsyncSessionLocal() as session:
        stmt = delete(CacheEntry).where(CacheEntry.expires_at < cutoff)
        result = await session.execute(stmt)
        await session.commit()
        logger.info(f"Cleared {result.rowcount} expired cache entries")
