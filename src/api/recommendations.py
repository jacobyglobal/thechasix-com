"""Similar ETF/stock recommendations based on duration decile vectors.

Ranks peers on a 1-10 scale (1 = no relationship, 10 = very high relationship)
using two signals combined:

1. Current profile similarity — Euclidean distance over the duration
   off-high/off-low decile vectors (4w/12w/26w/52w).
2. Time-series relationship — average Pearson correlation of daily returns
   across rolling windows (1m, 6m, 1y, 3y, 10y), so relationships that
   persist over time score higher than a single-snapshot match.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from fastapi import APIRouter, HTTPException

from src.core.market_highs_importer import build_decile_matrix, load_price_history

logger = logging.getLogger(__name__)

router = APIRouter()

# Rolling windows (in trading days) over which return correlation is measured.
CORRELATION_WINDOWS = [21, 126, 252, 756, 2520]  # ~1m, 6m, 1y, 3y, 10y


def _feature_columns(matrix: pd.DataFrame) -> list[str]:
    """Return the ordered feature columns (decile vectors)."""
    return [c for c in matrix.columns if c.startswith("high_") or c.startswith("low_")]


def _load_returns() -> dict[str, pd.Series]:
    """Load daily close series per ticker from the parquet cache."""
    from src.core.market_highs_importer import PARQUET_DIR  # noqa: PLC0415

    returns: dict[str, pd.Series] = {}
    for path in sorted(PARQUET_DIR.glob("*.parquet")):
        ticker = path.stem
        hist = load_price_history(ticker, limit=2520)
        items = hist.get("items", [])
        if not items:
            continue
        closes = pd.Series(
            {item.get("date"): item.get("close") for item in items if item.get("close") is not None}
        ).astype(float)
        if len(closes) > 2:
            returns[ticker] = closes.sort_index().pct_change()
    return returns


def _time_series_similarity(query: str, candidate: str, returns: dict[str, pd.Series]) -> float:
    """Average Pearson correlation of returns across several rolling windows."""
    q = returns.get(query)
    c = returns.get(candidate)
    if q is None or c is None:
        return 0.0
    corrs = []
    for window in CORRELATION_WINDOWS:
        q_win = q.iloc[-window:]
        c_win = c.reindex(q_win.index)
        valid = q_win.notna() & c_win.notna()
        if valid.sum() < 5:
            continue
        corr = q_win[valid].corr(c_win[valid])
        if np.isfinite(corr):
            corrs.append(corr)
    if not corrs:
        return 0.0
    return float(np.mean(corrs))


def similar_stocks_ranked(ticker: str, top_n: int = 5) -> dict:
    """Find ETFs/sectors most related to the given ticker, ranked 1-10.

    The rank combines current decile-profile similarity with multi-window
    return-correlation so the score reflects both the current market profile
    and the durability of the relationship over time.

    Returns:
        {"ticker": str, "as_of": str, "similar": [{ticker, rank, similarity, profile_score, time_score}, ...]}
    """
    ticker = ticker.upper()
    matrix = build_decile_matrix()
    if ticker not in matrix.index:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

    cols = _feature_columns(matrix)
    if len(cols) < 2:
        raise HTTPException(status_code=500, detail="Insufficient decile data for similarity")

    as_of = ""
    try:
        from src.core.market_highs_importer import load_detail  # noqa: PLC0415

        detail = load_detail()
        as_of = str(detail["date"].max())
    except Exception:  # noqa: BLE001
        pass

    returns = _load_returns()
    query_vec = matrix.loc[ticker, cols].to_numpy(dtype=float)

    scores = []
    for other in matrix.index:
        if other == ticker:
            continue
        vec = matrix.loc[other, cols].to_numpy(dtype=float)
        dist = float(np.sqrt(np.sum((query_vec - vec) ** 2)))
        profile_score = round(1.0 / (1.0 + dist), 4)  # 0..1
        time_score = round(max(0.0, _time_series_similarity(ticker, other, returns)), 4)
        # Blend: current profile (60%) + durability over time (40%).
        composite = 0.6 * profile_score + 0.4 * time_score
        scores.append({
            "ticker": other,
            "composite": composite,
            "profile_score": profile_score,
            "time_score": time_score,
        })

    # Rank by composite score (1 = best), then map to a 1-10 relationship rank.
    scores.sort(key=lambda x: x["composite"], reverse=True)
    n = len(scores)
    for i, item in enumerate(scores):
        # Percentile-based: top 10% -> 10, bottom 10% -> 1.
        percentile = (n - i) / n  # 1.0 for best, ~0 for worst
        item["rank"] = max(1, min(10, int(np.ceil(percentile * 10))))

    similar = [
        {
            "ticker": s["ticker"],
            "rank": s["rank"],
            "similarity": round(s["composite"], 4),
            "profile_score": s["profile_score"],
            "time_score": s["time_score"],
        }
        for s in scores[:top_n]
    ]
    return {"ticker": ticker, "as_of": as_of, "similar": similar}


@router.get("/{ticker}/similar")
async def similar_stocks(ticker: str, top_n: int = 5) -> dict:
    """Find ETFs/sectors most related to the given ticker, ranked 1-10."""
    return similar_stocks_ranked(ticker, top_n=top_n)
