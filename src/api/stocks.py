"""Stock/ETF screener and detail endpoints backed by MarketHighs data."""

import logging

from fastapi import APIRouter, HTTPException

from src.core.market_highs_importer import (
    load_leaderboard,
    get_ticker_profile,
    DURATIONS,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_stocks(
    sort_by: str = "composite_score",
    order: str = "desc",
    sector: str | None = None,
    limit: int = 50,
) -> dict:
    """Return the ETF/sector leaderboard.

    Query params:
        sort_by: column to sort on (default composite_score)
        order: 'asc' or 'desc'
        sector: optional sector name filter
        limit: max number of rows
    """
    df = load_leaderboard()
    if sector:
        df = df[df["sector"].str.lower() == sector.lower()]
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order.lower() == "asc"))
    df = df.head(limit)

    records = df.to_dict(orient="records")
    return {"count": len(records), "durations": DURATIONS, "items": records}


@router.get("/{ticker}")
async def get_stock(ticker: str) -> dict:
    """Return the full multi-duration market high/low profile for a ticker."""
    profile = get_ticker_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker.upper()} not found")
    return profile
