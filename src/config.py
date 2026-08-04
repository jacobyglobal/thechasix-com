"""Configuration management for The ChasIX platform.

Follows the pattern established in FinSeasonularity/config.py.
All paths, API endpoints, and environment variables are centralized here.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
DATA_DIR = PROJECT_ROOT / "data"
CACHE_DIR = DATA_DIR / "cache"
LOG_DIR = DATA_DIR / "logs"
CONTENT_DIR = PROJECT_ROOT / "content"
TEMPLATE_DIR = SRC_DIR / "templates"
STATIC_DIR = SRC_DIR / "static"
DIST_DIR = PROJECT_ROOT / "dist"

for d in [DATA_DIR, CACHE_DIR, LOG_DIR, CONTENT_DIR, TEMPLATE_DIR, STATIC_DIR, DIST_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")

# Schwab API
SCHWAB_CLIENT_ID = os.getenv("SCHWAB_CLIENT_ID", "")
SCHWAB_CLIENT_SECRET = os.getenv("SCHWAB_CLIENT_SECRET", "")
SCHWAB_REFRESH_TOKEN = os.getenv("SCHWAB_REFRESH_TOKEN", "")
SCHWAB_BASE_URL = "https://api.schwabapi.com"
SCHWAB_MARKETDATA_URL = f"{SCHWAB_BASE_URL}/marketdata/v1"
SCHWAB_TRADER_URL = f"{SCHWAB_BASE_URL}/trader/v1"
SCHWAB_OAUTH_URL = f"{SCHWAB_BASE_URL}/v1/oauth"
SCHWAB_RATE_LIMIT = 120  # requests per minute

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID_PRO_MONTHLY = os.getenv("STRIPE_PRICE_ID_PRO_MONTHLY", "")

# App
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.thechasix.com")
API_URL = os.getenv("API_URL", "https://api.thechasix.com")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Stock universe
DEFAULT_UNIVERSE = "sp500"
UNIVERSE_FILES = {
    "sp500": DATA_DIR / "sp500_tickers.csv",
    "russell3000": DATA_DIR / "russell3000_tickers.csv",
    "etfs": DATA_DIR / "etf_tickers.csv",
}

# Caching
CACHE_TTL_DEFAULT = 3600  # 1 hour in seconds
CACHE_TTL_FUNDAMENTALS = 86400  # 24 hours
CACHE_TTL_PRICE_HISTORY = 3600  # 1 hour

# Batch sizes for Schwab API calls
SCHWAB_BATCH_SIZE = 100  # max symbols per request
SCHWAB_MAX_RETRIES = 3
SCHWAB_RETRY_DELAY = 1  # seconds

# Premium content gating
FREE_STOCK_LIMIT = 10  # free users can view 10 stock details per day
PREMIUM_METRICS_ENABLED = True
PREMIUM_CONTENT_ENABLED = True
