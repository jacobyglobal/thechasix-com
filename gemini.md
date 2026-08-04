# OpenCode Agent Instructions: The ChasIX

## Project Context
You are building **The ChasIX — Financial Intelligence Platform**, a Python/FastAPI backend on Render + static frontend on Netlify. The project analyzes stock data from the Schwab API, computes unique metric composites, recommends similar stocks, and monetizes via Stripe subscriptions.

## Key Conventions (from existing projects)
1. All backend code in Python (FastAPI, pandas, numpy)
2. Use `config.py` for paths and configuration (matches FinSeasonularity pattern)
3. Tests use `pytest` with synthetic data (matches existing projects)
4. `.env` for secrets (never commit)
5. `requirements.txt` for dependencies
6. Project structure: `src/api/`, `src/core/`, `src/models/`, `src/templates/`
7. `backlog.csv` drives prioritization

## Development Commands
```bash
# Run backend locally
uvicorn src.main:app --reload

# Run tests
pytest --cov=src

# Build frontend (compile Jinja2 to static HTML for Netlify)
python -m src.build_frontend

# Run full pipeline locally
python -m src.scripts.refresh_data  # Nightly data refresh
```

## Environment Variables (.env)
```
DATABASE_URL=postgresql://user:pass@neon-host/dbname
SCHWAB_CLIENT_ID=your_app_key
SCHWAB_CLIENT_SECRET=your_secret
SCHWAB_REFRESH_TOKEN=your_refresh_token
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
SECRET_KEY=random_32_char_string_for_sessions
FRONTEND_URL=https://www.thechasix.com
```

## Wave 1 Focus (Current)
Build the MVP: stock data display with basic metrics and charts. No auth, no payments yet. Focus on:
1. Schwab API client (data fetching + caching to Neon)
2. Metrics engine (P/E, P/B, EV/EBITDA, FCF yield, market cap, dividend yield, debt/equity, ROE, beta)
3. Unique composites (Valuation Efficiency Score, Momentum-Quality Blend)
4. Stock screener page (sortable table)
5. Stock detail page with Plotly charts
6. Landing page with market movers
7. Unit tests for all components
8. Render deployment config + Netlify build script

## Code Style
- Follow PEP 8
- Use type hints everywhere
- No inline comments unless absolutely necessary
- Match existing project docstrings (Google style)
- Keep functions under 50 lines
- Use SQLAlchemy 2.0+ style (match models pattern from existing projects)

## Quality Gates
- All tests must pass before deploying: `pytest`
- Coverage must be >= 70% for core modules
- Manual verification of data accuracy against Yahoo Finance for at least 3 stocks
- Go/NO-GO gate after Wave 1: 10+ visitors exploring data for >2 minutes

## Key Reminders
- The user is the final backlog approver
- Never commit secrets (.env, API keys)
- Data must refresh via GitHub Actions (not Render background workers, which aren't free)
- Stripe is test mode until user flips to live
- Netlify serves static frontend; Render serves API only
- CORS must be configured: Netlify (thechasix.com) -> Render (api.thechasix.com)
