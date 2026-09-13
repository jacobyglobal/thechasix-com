"""Service-status endpoint for The ChasIX API.

Reports basic service status (version, uptime, database reachability).
Database reachability is best-effort and never raises — mirroring the
"continuing without DB" resilience in src/main.py.
"""

import logging
import time

from fastapi import APIRouter
from sqlalchemy import text

from src.core.cache import engine

logger = logging.getLogger(__name__)

router = APIRouter()

_START = time.monotonic()
VERSION = "0.1.0"


async def _check_database() -> str:
    """Return "up" if the DB answers a trivial query, else "down" (never raises)."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "up"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Database health check failed: %s", exc)
        return "down"


@router.get("")
async def health() -> dict:
    """Service-status endpoint: always 200, reports DB reachability."""
    return {
        "status": "ok",
        "service": "thechasix-api",
        "version": VERSION,
        "uptime_seconds": int(time.monotonic() - _START),
        "database": await _check_database(),
    }