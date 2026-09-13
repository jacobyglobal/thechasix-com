"""Tests for the /api/news endpoint."""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from sqlalchemy import insert, delete

from src.main import app
from src.core.cache import AsyncSessionLocal, NewsArticleRow

client = TestClient(app)

def setup_module(module):
    """Clean the DB before running tests."""
    import asyncio
    async def clean():
        async with AsyncSessionLocal() as session:
            await session.execute(delete(NewsArticleRow))
            await session.commit()
    asyncio.run(clean())

def test_news_empty_db_returns_200():
    """Ensure API returns 200 and empty list when no data."""
    # Assuming we start with an empty or clean DB for test
    resp = client.get("/api/news")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["count"] == 0
    assert data["items"] == []

def test_news_data_filtering():
    """Ensure API correctly filters by ticker and sentiment."""
    # Insert some dummy data
    import asyncio
    
    async def add_dummy_data():
        async with AsyncSessionLocal() as session:
            # Clear old
            await session.execute(
                delete(NewsArticleRow)
            )
            # Add new
            await session.execute(
                insert(NewsArticleRow).values(
                    ticker="AAPL",
                    title="AAPL News",
                    news_url="http://apple.com/news1",
                    published_at=datetime.utcnow(),
                    sentiment_label="positive",
                    is_filtered=False
                )
            )
            await session.execute(
                insert(NewsArticleRow).values(
                    ticker="GOOG",
                    title="GOOG News",
                    news_url="http://google.com/news1",
                    published_at=datetime.utcnow(),
                    sentiment_label="negative",
                    is_filtered=False
                )
            )
            await session.commit()

    asyncio.run(add_dummy_data())

    # Test no filter
    resp = client.get("/api/news")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 2
    
    # Test ticker filter
    resp = client.get("/api/news?ticker=AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["items"][0]["ticker"] == "AAPL"
    
    # Test sentiment filter
    resp = client.get("/api/news?sentiment=negative")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 1
    assert data["items"][0]["ticker"] == "GOOG"
