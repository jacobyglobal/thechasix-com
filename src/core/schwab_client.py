"""Schwab API client with OAuth2 token management and rate limiting.

Handles: OAuth2 refresh tokens, bulk quotes with 100-symbol batching,
price history, fundamentals, and market movers.
Rate limit: 120 requests/minute (batched).
"""

import asyncio
import httpx
import time
import logging
from typing import Any
from src.config import (
    SCHWAB_OAUTH_URL, SCHWAB_MARKETDATA_URL, SCHWAB_CLIENT_ID,
    SCHWAB_CLIENT_SECRET, SCHWAB_REFRESH_TOKEN, SCHWAB_BATCH_SIZE,
    SCHWAB_MAX_RETRIES, SCHWAB_RETRY_DELAY,
)

logger = logging.getLogger(__name__)


class SchwabClient:
    """Async Schwab API client with token refresh and rate limiting."""

    def __init__(self):
        self._access_token: str | None = None
        self._token_expires_at: float = 0
        self._client: httpx.AsyncClient | None = None

    async def _ensure_client(self):
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=SCHWAB_MARKETDATA_URL,
                timeout=30.0,
            )
        return self._client

    async def refresh_token(self) -> str:
        """Refresh OAuth2 access token using the stored refresh token."""
        if self._access_token and time.time() < self._token_expires_at - 60:
            return self._access_token

        oauth_client = httpx.AsyncClient(base_url=SCHWAB_OAUTH_URL, timeout=30.0)
        try:
            resp = await oauth_client.post(
                "/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": SCHWAB_REFRESH_TOKEN,
                    "client_id": SCHWAB_CLIENT_ID,
                    "client_secret": SCHWAB_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            self._token_expires_at = time.time() + data.get("expires_in", 1800)
            logger.info("Schwab OAuth token refreshed successfully.")
            return self._access_token
        finally:
            await oauth_client.aclose()

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        """Make an authenticated GET request with retry logic."""
        client = await self._ensure_client()
        token = await self.refresh_token()

        headers = {"Authorization": f"Bearer {token}"}
        url = f"{SCHWAB_MARKETDATA_URL}{path}"

        for attempt in range(SCHWAB_MAX_RETRIES):
            try:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code == 429:
                    delay = SCHWAB_RETRY_DELAY * (2 ** attempt)
                    logger.warning(f"Rate limited. Retrying in {delay}s (attempt {attempt+1})")
                    await asyncio.sleep(delay)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if attempt == SCHWAB_MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(SCHWAB_RETRY_DELAY)

        raise RuntimeError("Max retries exceeded")

    async def get_quotes(self, symbols: list[str]) -> dict[str, Any]:
        """Fetch bulk quotes for up to 100 symbols (Schwab limit per request).

        Args:
            symbols: List of ticker symbols (max 100 per call).

        Returns:
            Dict keyed by symbol with quote + fundamental data.
        """
        if len(symbols) > SCHWAB_BATCH_SIZE:
            raise ValueError(f"Max {SCHWAB_BATCH_SIZE} symbols per request, got {len(symbols)}")

        symbol_str = ",".join(symbols)
        return await self._get("/quotes", params={
            "symbols": symbol_str,
            "fields": "quote,fundamental",
        })

    async def get_quotes_batch(self, symbols: list[str]) -> dict[str, Any]:
        """Fetch quotes for any number of symbols by batching."""
        results: dict[str, Any] = {}
        for i in range(0, len(symbols), SCHWAB_BATCH_SIZE):
            batch = symbols[i:i + SCHWAB_BATCH_SIZE]
            quotes = await self.get_quotes(batch)
            results.update(quotes)
            # Rate limit: space out requests slightly
            if i + SCHWAB_BATCH_SIZE < len(symbols):
                await asyncio.sleep(0.1)
        return results

    async def get_price_history(
        self,
        symbol: str,
        period: int = 1,
        period_type: str = "year",
        frequency: int = 1,
        frequency_type: str = "daily",
    ) -> dict[str, Any]:
        """Fetch historical price data.

        Args:
            symbol: Ticker symbol.
            period: Number of period_type units (1-10 for year/day, 1-20 for month, 1-3 for week).
            period_type: day, month, year, ytd.
            frequency: 1-3 for minute, any for daily+.
            frequency_type: minute, daily, weekly, monthly.
        """
        return await self._get(
            f"/{symbol}/pricehistory",
            params={
                "symbol": symbol,
                "period": period,
                "periodType": period_type,
                "frequency": frequency,
                "frequencyType": frequency_type,
            },
        )

    async def get_fundamental(self, symbol: str) -> dict[str, Any]:
        """Fetch detailed fundamental data for a single symbol."""
        return await self._get("/instruments", params={
            "symbol": symbol,
            "projection": "fundamental",
        })

    async def get_movers(
        self,
        index: str = "$SPX",
        sort: str = "VOLUME",
        frequency: int = 0,
    ) -> dict[str, Any]:
        """Get market movers (top gainers/losers by volume or percent change)."""
        return await self._get("/movers", params={
            "symbol": index,
            "sort": sort,
            "frequency": frequency,
        })

    async def get_instruments(self, symbol: str) -> dict[str, Any]:
        """Look up instrument info (sector, industry, etc.)."""
        return await self._get("/instruments", params={
            "symbol": symbol,
            "projection": "symbol-search",
        })

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


# Global instance (matches pattern from existing projects)
schwab_client = SchwabClient()
