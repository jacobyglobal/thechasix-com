"""Similar ETF/stock recommendations based on duration decile vectors."""

import logging

import numpy as np

from fastapi import APIRouter, HTTPException

from src.core.market_highs_importer import build_decile_matrix

logger = logging.getLogger(__name__)

router = APIRouter()


def _feature_columns(matrix):
    """Return the ordered feature columns (decile vectors)."""
    return [c for c in matrix.columns if c.startswith("high_") or c.startswith("low_")]


@router.get("/{ticker}/similar")
async def similar_stocks(ticker: str, top_n: int = 5) -> dict:
    """Find ETFs/sectors most similar to the given ticker.

    Similarity is Euclidean distance over the normalized duration decile
    vectors (off-high/off-low deciles across 4w/12w/26w/52w horizons).
    Lower distance = more similar market profile.
    """
    matrix = build_decile_matrix()
    ticker = ticker.upper()

    if ticker not in matrix.index:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not found")

    cols = _feature_columns(matrix)
    if len(cols) < 2:
        raise HTTPException(status_code=500, detail="Insufficient decile data for similarity")

    query = matrix.loc[ticker, cols].to_numpy(dtype=float)
    distances = []
    for other in matrix.index:
        if other == ticker:
            continue
        vec = matrix.loc[other, cols].to_numpy(dtype=float)
        dist = float(np.sqrt(np.sum((query - vec) ** 2)))
        distances.append({"ticker": other, "similarity_score": round(1.0 / (1.0 + dist), 4), "distance": round(dist, 4)})

    distances.sort(key=lambda x: x["distance"])
    return {"ticker": ticker, "similar": distances[:top_n]}
