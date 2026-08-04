"""Payments endpoints (Wave 2 placeholder)."""

import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def payments_status() -> dict:
    """Return payment feature availability.

    Stripe Checkout for one-time digital content sales is a Wave 2 feature.
    """
    return {"payments_enabled": False, "wave": 2, "message": "Stripe digital content sales arrive in Wave 2"}
