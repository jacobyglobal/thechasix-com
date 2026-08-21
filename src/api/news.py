"""News Ranking API — reads ranked articles written by the NewsRanking pipeline.

The NewsRanking project (../NewsRanking) fetches news, scores sentiment with
VADER, correlates with price signals (RVOL + log return), and upserts rows into
the shared database (Neon in prod, SQLite in local dev). This router serves
those rows to the frontend at /api/news.
"""

import logging
import math
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from src.core.cache import AsyncSessionLocal, NewsArticleRow

logger = logging.getLogger(__name__)

router = APIRouter()


def _row_to_dict(row: NewsArticleRow) -> dict:
    """Serialize a news_articles row to the frontend shape."""
    # Catalyst Day: the ticker actually moved intraday (RVOL >= 2 or |log
    # return| >= ~2%), so a catalyst story is worth hunting for.
    rvol = row.rvol
    chg = row.log_return
    catalyst = (rvol is not None and rvol >= 2.0) or (
        chg is not None and abs(math.exp(chg) - 1.0) >= 0.02
    )
    return {
        "ticker": row.ticker,
        "title": row.title,
        "summary": row.summary,
        "source": row.source,
        "url": row.news_url,
        "published_at": row.published_at.isoformat() if row.published_at else None,
        "sentiment": row.sentiment_label,
        "vader_compound": row.vader_compound,
        "av_sentiment_score": row.av_sentiment_score,
        "av_sentiment_label": row.av_sentiment_label,
        "rvol": rvol,
        "log_return": chg,
        "close": row.target_price,
        "volume": row.volume,
        "signal_strength": row.signal_strength,
        "rank": row.rank,
        "recency": row.recency,
        "source_weight": row.source_weight,
        "nearest_inflection_at": (
            row.nearest_inflection_at.isoformat() if row.nearest_inflection_at else None
        ),
        "catalyst": catalyst,
    }


@router.get("")
async def get_news(
    ticker: str | None = None,
    sentiment: str | None = None,
    limit: int = 50,
    offset: int = 0,
    top_n_per_ticker: int | None = None,
) -> dict:
    """Return ranked news articles, strongest signal first.

    Query params:
        ticker:            filter to a single ticker (upper-cased)
        sentiment:         filter to positive / negative / neutral
        limit:             max articles to return (default 50)
        offset:            pagination offset
        top_n_per_ticker:  when set (>0), keep only the top N ranked articles
                           per ticker (assessing the ranker surfaces catalysts).
    """
    order = (
        NewsArticleRow.signal_strength.desc().nullslast(),
        NewsArticleRow.published_at.desc().nullslast(),
    )
    query = select(NewsArticleRow).order_by(
        NewsArticleRow.signal_strength.desc().nullslast(),
        NewsArticleRow.published_at.desc().nullslast(),
    )
    # Only publish rows that cleared the noise/dedup filter.
    query = query.where(NewsArticleRow.is_filtered == 0)
    if ticker:
        query = query.where(NewsArticleRow.ticker == ticker.upper())
    if sentiment:
        query = query.where(NewsArticleRow.sentiment_label == sentiment)
    if not top_n_per_ticker or top_n_per_ticker <= 0:
        query = query.offset(offset).limit(limit)

    async with AsyncSessionLocal() as session:
        result = await session.execute(query)
        rows = result.scalars().all()

    if top_n_per_ticker and top_n_per_ticker > 0:
        # Whole result trusted to be pre-sorted by signal strength (strongest
        # first) — keep a running per-ticker counter and drop anything past N.
        kept: list = []
        per_ticker: dict[str, int] = {}
        for row in rows:
            if per_ticker.get(row.ticker, 0) < top_n_per_ticker:
                kept.append(row)
                per_ticker[row.ticker] = per_ticker.get(row.ticker, 0) + 1

    items = [_row_to_dict(r) for r in (kept if top_n_per_ticker and top_n_per_ticker > 0 else rows)]
    return {
        "count": len(items),
        "offset": offset,
        "items": items,
    }


@router.get("/status")
async def news_status() -> dict:
    """Return pipeline + DB summary for the news feature."""
    async with AsyncSessionLocal() as session:
        total = await session.scalar(select(func.count()).select_from(NewsArticleRow))
        latest = await session.scalar(
            select(func.max(NewsArticleRow.fetched_at)).select_from(NewsArticleRow)
        )
        by_sentiment = {}
        for label, count in await session.execute(
            select(NewsArticleRow.sentiment_label, func.count())
            .group_by(NewsArticleRow.sentiment_label)
        ):
            by_sentiment[label] = count

    return {
        "enabled": True,
        "articles_total": total or 0,
        "last_refresh": latest.isoformat() if latest else None,
        "by_sentiment": by_sentiment,
    }