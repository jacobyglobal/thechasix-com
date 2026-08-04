"""Auth endpoints (Wave 4 placeholder)."""

import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def auth_status() -> dict:
    """Return auth feature availability.

    User registration/login is a Wave 4 feature; the MVP serves public
    market data without accounts.
    """
    return {"auth_enabled": False, "wave": 4, "message": "User accounts arrive in Wave 4"}
