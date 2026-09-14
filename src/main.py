"""FastAPI application entry point for The ChasIX platform.

This is the backend API server (deployed on Render).
The frontend is served as static HTML from Netlify.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from src.config import STATIC_DIR, DEBUG, FRONTEND_URL, API_URL
from src.api.stocks import router as stocks_router
from src.api.metrics import router as metrics_router
from src.api.recommendations import router as recs_router
from src.api.auth import router as auth_router
from src.api.payments import router as payments_router
from src.api.watchlist import router as watchlist_router
from src.api.news import router as news_router
from src.api.health import router as health_router
from src.core.cache import init_db
from src.core.schwab_client import schwab_client

logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO)
logger = logging.getLogger(__name__)

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    logger.info("Initializing database connections...")
    try:
        await init_db()
        logger.info("Database initialized.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Database initialization failed (continuing without DB): %s", exc)
    yield
    logger.info("Shutting down...")
    await schwab_client.close()


app = FastAPI(
    title="The ChasIX API",
    description="Financial Intelligence Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.thechasix.com",
        "https://thechasix.com",
        "https://api.thechasix.com",
        FRONTEND_URL,
        API_URL,
    ] if not DEBUG else ["*"],
    allow_origin_regex=(
        r"https://.*\.netlify\.app|http://(localhost|127\.0\.0\.1)(:\d+)?"
        if not DEBUG
        else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(stocks_router, prefix="/api/stocks", tags=["stocks"])
app.include_router(metrics_router, prefix="/api/metrics", tags=["metrics"])
app.include_router(recs_router, prefix="/api/stocks", tags=["recommendations"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(payments_router, prefix="/api/payments", tags=["payments"])
app.include_router(watchlist_router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(news_router, prefix="/api/news", tags=["news"])
app.include_router(health_router, prefix="/api/health", tags=["health"])


def _serve_page(filename: str, status_code: int = 200) -> HTMLResponse:
    """Serve a pre-built HTML page from dist/."""
    path = DIST_DIR / filename
    if path.exists():
        return HTMLResponse(content=path.read_text(encoding="utf-8"), status_code=status_code)
    return HTMLResponse(content="<html><body>Page not found</body></html>", status_code=404)


@app.get("/")
async def root():
    """Root endpoint so / does not 404."""
    return {"message": "The ChasIX API", "docs": "/docs", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint for Render."""
    return {"status": "healthy", "version": "0.1.0"}


# --- Page routes (serve pre-built HTML from dist/) ---

@app.get("/screener")
async def screener_page(type: str = Query("etf", alias="type")):
    """Master tabular screener view. Defaults to ?type=etf."""
    return _serve_page("screener.html")


@app.get("/views")
async def views_page():
    """Views container landing page."""
    return _serve_page("views.html")


@app.get("/views/deciles")
async def views_deciles_page():
    """52-week decile range analysis view."""
    return _serve_page("views.html")


@app.get("/chart/{symbol}")
async def chart_detail_page(symbol: str):
    """Chart Detail page for a specific ticker."""
    return _serve_page("chart.html")


@app.get("/news")
async def news_page():
    """News ranking page."""
    return _serve_page("news.html")


@app.get("/edge")
async def edge_page():
    """Trading expectancy & risk of ruin calculator."""
    return _serve_page("calculator.html")


# --- 301 Permanent Redirects ---

@app.get("/watchlist", include_in_schema=False)
async def redirect_watchlist():
    """Legacy route → /views (301)."""
    return RedirectResponse(url="/views", status_code=301)


@app.get("/deciles", include_in_schema=False)
async def redirect_deciles():
    """Legacy route → /views/deciles (301)."""
    return RedirectResponse(url="/views/deciles", status_code=301)


@app.get("/stock", include_in_schema=False)
async def redirect_stock(ticker: str = Query(...)):
    """Legacy route /stock?ticker=X → /chart/X (301)."""
    return RedirectResponse(url=f"/chart/{ticker}", status_code=301)


@app.get("/chart", include_in_schema=False)
async def redirect_chart(ticker: str = Query(...)):
    """Legacy route /chart?ticker=X → /chart/X (301)."""
    return RedirectResponse(url=f"/chart/{ticker}", status_code=301)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
