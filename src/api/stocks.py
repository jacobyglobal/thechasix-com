"""Stock/ETF screener and detail endpoints backed by MarketHighs data."""

import logging

from fastapi import APIRouter, HTTPException

from src.core.market_highs_importer import (
    load_leaderboard_enriched,
    get_ticker_profile,
    load_etf_tickers,
    load_price_history,
    DURATIONS,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_stocks(
    sort_by: str = "composite_score",
    order: str = "desc",
    sector: str | None = None,
    type: str | None = None,
    limit: int = 50,
) -> dict:
    """Return the ETF/sector leaderboard.

    Query params:
        sort_by: column to sort on (default composite_score)
        order: 'asc' or 'desc'
        sector: optional sector name filter
        type: 'etf' restricts to the tracked ETF landscape (homepage scope);
              default returns the full universe (stocks + ETFs)
        limit: max number of rows
    """
    df = load_leaderboard_enriched()
    if sector:
        df = df[df["sector"].str.lower() == sector.lower()]
    if type and type.lower() == "etf":
        etfs = load_etf_tickers()
        df = df[df["ticker"].isin(etfs)]
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order.lower() == "asc"))
    df = df.head(limit)

    records = df.to_dict(orient="records")
    return {"count": len(records), "durations": DURATIONS, "as_of": df["date"].iloc[0] if len(df) else "", "items": records}


@router.get("/{ticker}")
async def get_stock(ticker: str) -> dict:
    """Return the full multi-duration market high/low profile for a ticker."""
    profile = get_ticker_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker.upper()} not found")
    return profile


@router.get("/{ticker}/chart")
async def get_stock_chart(ticker: str, limit: int = 2520) -> dict:
    """Return daily OHLCV price history for charting (10 years by default)."""
    history = load_price_history(ticker, limit=limit)
    if not history:
        raise HTTPException(status_code=404, detail=f"No price history for {ticker.upper()}")
    return history
