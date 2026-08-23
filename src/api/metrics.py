"""Market breadth and metrics endpoints backed by MarketHighs data."""

import logging

from fastapi import APIRouter, HTTPException

from src.core.market_highs_importer import (
    load_breadth,
    load_detail,
    get_ticker_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter()

AVAILABLE_METRICS = [
    "off_high_pct",
    "off_low_pct",
    "off_high_decile",
    "off_low_decile",
    "at_high",
    "at_low",
    "recent_close",
    "period_high_value",
    "period_low_value",
]


@router.get("/available")
async def list_available_metrics() -> dict:
    """List all available metrics exposed by the API."""
    return {"metrics": AVAILABLE_METRICS}


@router.get("/breadth")
async def market_breadth(scope: str = "etf") -> dict:
    """Return aggregate market breadth stats per duration horizon.

    Query params:
        scope: 'etf' (default) restricts to the tracked ETF landscape;
               'all' returns the universe-wide pipeline aggregates.
    """
    df = load_breadth(scope="etf" if scope.lower() == "etf" else "all")
    records = df.to_dict(orient="records")
    return {"count": len(records), "scope": "etf" if scope.lower() == "etf" else "all", "items": records}


@router.get("/extremes")
async def market_extremes(limit: int = 10) -> dict:
    """Return tickers currently at/near their period highs or lows.

    Uses the detail rows across all durations to surface the strongest
    and weakest market profiles by off-high/off-low decile (both deciles
    strength-polarity: 10 = nearest high / farthest off low).
    """
    df = load_detail()
    df["off_high_decile"] = df["off_high_decile"].astype(int)
    # Raw off_low_decile is proximity-polarity (10 = nearest the low); reflect
    # to strength polarity (10 = farthest off the low) to match off_high_decile.
    df["off_low_decile"] = 11 - df["off_low_decile"].astype(int)

    strongest = (
        df.sort_values(["off_high_decile", "off_low_decile"], ascending=[False, False])
        .head(limit)
        .to_dict(orient="records")
    )
    weakest = (
        df.sort_values(["off_high_decile", "off_low_decile"], ascending=[True, True])
        .head(limit)
        .to_dict(orient="records")
    )

    return {"strongest": strongest, "weakest": weakest}


@router.get("/{ticker}")
async def get_metrics(ticker: str) -> dict:
    """Get computed metrics for a single ticker (multi-duration profile)."""
    profile = get_ticker_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker.upper()} not found")
    return {"ticker": ticker.upper(), "metrics": AVAILABLE_METRICS, "profile": profile}
