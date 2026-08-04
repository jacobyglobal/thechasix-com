"""FastAPI application entry point for The ChasIX platform.

This is the backend API server (deployed on Render).
The frontend is served as static HTML from Netlify.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from src.config import STATIC_DIR, DEBUG, FRONTEND_URL, API_URL
from src.api.stocks import router as stocks_router
from src.api.metrics import router as metrics_router
from src.api.recommendations import router as recs_router
from src.api.auth import router as auth_router
from src.api.payments import router as payments_router
from src.core.cache import init_db
from src.core.schwab_client import schwab_client

logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO)
logger = logging.getLogger(__name__)


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
    allow_origins=[FRONTEND_URL, API_URL] if not DEBUG else ["*"],
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


@app.get("/health")
async def health_check():
    """Health check endpoint for Render."""
    return {"status": "healthy", "version": "0.1.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
