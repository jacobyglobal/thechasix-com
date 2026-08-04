# The ChasIX — Financial Intelligence Platform: Execution Plan

## Objective
Recreate a Finviz/Fangraphs-style financial data site on `thechasix.com`, powered by MarketHighs ETF historical data (10-year history + sector market high/low decile metrics) and yfinance/Schwab API data. Deliver unique composite metrics, a "similar ETFs/stocks" recommendation engine, and Stripe-gated digital content sales — all bootstrapped at zero cost using Netlify + Render + Neon free tiers.

## Architecture Decision (Finalized)

| Layer | Choice | Free Tier | Commercial Use |
|-------|--------|-----------|----------------|
| Frontend | **Netlify** (static site + edge CDN) | ~30 GB bandwidth, 300 credits/month | Yes |
| Backend API | **Render Hobby** (FastAPI) | 750 hrs/month, 5 GB bandwidth | Yes |
| Database | **Neon PostgreSQL** | 3 GB storage, scale-to-zero | Yes |
| Data Refresh | **GitHub Actions cron** | 2,000 min/month | Yes |
| Payments | **Stripe Checkout** (Digital Content & Subscriptions) | No monthly fee (2.9% + 30¢/txn) | Yes |
| Analytics | **Server-side logging** | Built into FastAPI | Yes |

## OpenCode Free-Tier Model Hierarchy & Quota Strategy

To maximize efficiency and avoid hitches when approaching rate/quota limits in OpenCode:

| Task / Domain | Recommended Free Model | Strategic Notes |
|---------------|------------------------|-----------------|
| **Frontend Development** (HTML templates, Jinja2, CSS, JS) | `google/gemini-2.5-flash-lite` | Ultra-fast execution, low context window overhead. |
| **Backend API & Data Pipelines** (FastAPI, Python scripts, SQL) | `google/gemini-2.5-flash-lite` | High precision code generation with low token consumption. |
| **Architecture Planning & TPM Workflows** | `google/gemini-3.6-flash` | High contextual reasoning for complex planning and refactoring. |
| **Fallback Models (When Gemini Rate Limited)** | `opencode/big-pickle` / `opencode/nemotron-3-ultra-free` | Backup models to switch to if primary Gemini endpoints hit rate limits or timeouts. |
| **Laguna Agent Sessions** | Strategic / Complex Tasks Only | Laguna agents use heavy iterative subagent calls; use sparingly for large multi-file features to preserve daily quota limits. |

**Why NOT Vercel Hobby**: Explicitly prohibits commercial use. Stripe payments = commercial activity.
**Why NOT Shopify Hydrogen**: Requires $29+/month Shopify subscription.
**Why NOT single-platform (Render only)**: Netlify CDN eliminates cold starts for static content; 30GB combined bandwidth extends runway significantly.

## Data Flow Architecture
```
Nightly:  GitHub Actions -> MarketHighs / yfinance -> Neon PostgreSQL
                                                          |
User:     Netlify CDN (HTML/CSS/JS)                      |
          -> Render (FastAPI API via /api/* proxy) -> Neon
          -> Stripe (Checkout + Webhooks -> Render)
```

## Data Schema & Source Integration

### Core Initial Dataset: MarketHighs ETF & Sector Metrics
1. **Source**: 10 years of ETF stock history data (`MarketHighs/data/`) and sector market high/low deciles (`MarketHighs/output/detail.csv`).
2. **Schema**:
   - `ticker`: Symbol (e.g., `XLB`, `XBI`, `XLC`, `XLY`, `XLP`, `DIA`, `XLE`, `XLF`, `XLV`, `XLI`, `QQQ`, `XLRE`, `IWM`)
   - `sector`: Sector name (e.g., `Basic Materials`, `Biotech`, `Financials`, `Nasdaq 100`)
   - `duration` & `days`: Horizon ranges (`4w`/20d, `12w`/60d, `26w`/130d, `52w`/252d)
   - `recent_close`, `period_high_value`, `period_low_value`: Key price benchmarks
   - `off_high_pct`, `off_low_pct`: Percentage distances
   - `at_high`, `at_low`: Extreme status flags
   - `off_high_decile`, `off_low_decile`: Normalized 1-10 rankings

### Supplementary Data Source: Schwab Trader / Market Data API
- **OAuth**: `https://api.schwabapi.com/v1/oauth`
- **Market Data**: `https://api.schwabapi.com/marketdata/v1`
- **Rate Limit Strategy**: 120 req/min limit. Batch quotes up to 100 symbols per request. Cache heavily in Neon PostgreSQL.

## Human-Required Actions (Detailed Instructions)

### 1. GitHub Repository Creation
**Your Steps**:
1. Go to https://github.com/new
2. Repository name: `thechasix-com`
3. Description: "The ChasIX — Financial Intelligence Platform"
4. Set to **Public** (free Render/Netlify deployments need public repos on free tier)
5. Initialize with: **None** (uncheck "Add a README")
6. Click "Create repository"
7. Note the HTTPS URL (e.g., `https://github.com/yourusername/thechasix-com.git`)

### 2. Stripe Account Setup / Recovery
**Your Steps**:
1. Go to https://dashboard.stripe.com/
2. Recover or sign in to your Stripe account.
3. Navigate to **Developers -> API keys**:
   - Copy `STRIPE_PUBLISHABLE_KEY` (`pk_live_...` or `pk_test_...`)
   - Copy `STRIPE_SECRET_KEY` (`sk_live_...` or `sk_test_...`)
4. Create a One-Time Payment Digital Content product (e.g. "$9.99 Market Intelligence Report").
5. Webhook endpoint set after Render deploy: `https://api.thechasix.com/webhook/stripe`

### 3. Neon PostgreSQL Setup
**Your Steps**:
1. Sign up at https://neon.tech (use GitHub login)
2. Create new project: `thechasix-db`
3. Copy the connection string (`postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`)
4. Save as `DATABASE_URL` in environment.

### 4. Render Account Setup
**Your Steps**:
1. Sign up at https://render.com (use GitHub login)
2. Dashboard -> New -> Web Service -> Connect `thechasix-com` repo
3. Settings:
   - Name: `thechasix-api`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`

### 5. Netlify Account Setup
**Your Steps**:
1. Sign up at https://netlify.com (use GitHub login)
2. Add new site -> Import `thechasix-com` repo
3. Settings:
   - Build command: `python -m src.build_frontend`
   - Publish directory: `dist/`
4. Environment Variables: `API_ROOT`, `STRIPE_PUBLISHABLE_KEY`

### 6. GoDaddy DNS Configuration
**Your Steps**:
1. CNAME `www` -> `thechasix-com.netlify.app`
2. CNAME `api` -> `thechasix-api.onrender.com`
3. A Record `@` -> Netlify load balancer IP

## Project Structure
```
TheChasIX.com/
├── plan.md, plan.human.md, gemini.md, opencode.json
├── .env.example, .gitignore, requirements.txt, render.yaml, netlify.toml
├── backlog.csv
├── content/{reports,dashboards,downloads}/
├── src/
│   ├── __init__.py, main.py, config.py, build_frontend.py
│   ├── api/{stocks.py, metrics.py, recommendations.py, auth.py, payments.py}
│   ├── core/{schwab_client.py, metrics_engine.py, recommender.py, cache.py, market_highs_importer.py}
│   ├── models/{stock.py, user.py, subscription.py, content.py}
│   ├── templates/{base.html, index.html, screener.html, stock_detail.html, pricing.html}
│   └── tests/{test_metrics.py, test_recommender.py}
└── .github/workflows/data-refresh.yml
```

## Agile Implementation Waves

### Wave 1: MVP — ETF Data, Market Breadth & Free Tier Screener
1. Core database schema for Stock, ETFMetric, MarketHighDetail.
2. MarketHighs importer (`market_highs_importer.py`) to parse `detail.csv`/`detail.json` and 10-year ETF history.
3. Stock/ETF screener API and static frontend with sortable market highs deciles.
4. Render API + Netlify static build deployment.

### Wave 2: Monetization — Digital Content Sales via Stripe
1. Stripe Checkout session endpoints for purchasing standalone digital reports / data downloads.
2. Stripe webhook handler (`/webhook/stripe`) to grant instant access to paid digital downloads.
3. Free vs Paid content indicators on detail pages.

### Wave 3: Recommendations & Composite Analytics
1. Distance-based similarity algorithm using duration decile vectors (`4w`, `12w`, `26w`, `52w` off-high/off-low deciles).
2. "Similar ETFs / Market Profiles" panel on stock detail page.
3. SEO optimization and automated sitemap generation.

### Wave 4: User Accounts & Subscriptions
1. Optional user registration and login.
2. Recurring monthly subscription tier (Pro $9.99/mo).

