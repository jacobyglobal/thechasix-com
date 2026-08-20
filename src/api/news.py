"""News Ranking API — reads ranked articles written by the NewsRanking pipeline.

The NewsRanking project (../NewsRanking) fetches news, scores sentiment with
VADER, correlates with price signals (RVOL + log return), and upserts rows into
the shared database (Neon in prod, SQLite in local dev). This router serves
those rows to the frontend at /api/news.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from src.core.cache import AsyncSessionLocal, NewsArticleRow

logger = logging.getLogger(__name__)

router = APIRouter()


def _row_to_dict(row: NewsArticleRow) -> dict:
    """Serialize a news_articles row to the frontend shape."""
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
        "rvol": row.rvol,
        "log_return": row.log_return,
        "close": row.target_price,
        "volume": row.volume,
        "signal_strength": row.signal_strength,
        "rank": row.rank,
        "recency": row.recency,
        "source_weight": row.source_weight,
        "nearest_inflection_at": (
            row.nearest_inflection_at.isoformat() if row.nearest_inflection_at else None
        ),
    }


@router.get("")
async def get_news(
    ticker: str | None = None,
    sentiment: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Return ranked news articles, strongest signal first.

    Query params:
        ticker:    filter to a single ticker (upper-cased)
        sentiment: filter to positive / negative / neutral
        limit:     max articles to return (default 50)
        offset:    pagination offset
    """
    query = select(NewsArticleRow).order_by(
        NewsArticleRow.signal_strength.desc().nullslast(),
        NewsArticleRow.published_at.desc().nullslast(),
    )
    if ticker:
        query = query.where(NewsArticleRow.ticker == ticker.upper())
    if sentiment:
        query = query.where(NewsArticleRow.sentiment_label == sentiment)
    query = query.offset(offset).limit(limit)

    async with AsyncSessionLocal() as session:
        result = await session.execute(query)
        rows = result.scalars().all()

    return {
        "count": len(rows),
        "offset": offset,
        "items": [_row_to_dict(r) for r in rows],
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