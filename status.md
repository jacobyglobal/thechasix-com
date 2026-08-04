# The ChasIX — Setup Status Tracker

Last updated: 2026-08-04

## Platform Naming Convention
All platforms use the name **`thechasix-com`** for 100% consistency.

## Completed

### 1. GitHub Repository
- [x] Created public repo: https://github.com/jacobyglobal/thechasix-com
- [x] Pushed initial commit (`main` branch)
- [x] Sanitized `.env.example` (removed placeholder secret patterns flagged by push protection)

### 2. Neon PostgreSQL
- [x] Account created via GitHub
- [x] Project created: `thechasix-com`
- [x] Connection string captured (`DATABASE_URL`)
- [x] Neon Auth: **Not enabled** (deferred to Wave 4, not needed for MVP)

### 3. Render Web Service
- [x] Account created via GitHub
- [x] Web Service created: `thechasix-com`
- [x] Runtime: Python 3, Branch: `main`, Region: Oregon (US West)
- [x] Build Command: `pip install -r requirements.txt`
- [x] Start Command: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
- [ ] Environment Variables added:
  - [x] `DATABASE_URL` (from Neon)
  - [ ] `STRIPE_SECRET_KEY` (pending Stripe setup — not started)
  - [ ] `STRIPE_WEBHOOK_SECRET` (pending Stripe setup — not started)
  - [ ] `SECRET_KEY` (generate random 32-char string)
  - [ ] `FRONTEND_URL` = `https://www.thechasix.com`

### 4. Netlify Site
- [x] Account created via GitHub
- [x] Import repo `thechasix-com`
- [x] Build command: `python -m src.build_frontend`
- [x] Publish directory: `dist/`
- [x] First production deploy succeeded (2026-08-03, commit `0261294`)
- [x] Site URL: https://boisterous-rabanadas-45ce33.netlify.app
- [ ] Environment variables: `STRIPE_PUBLISHABLE_KEY`, `API_ROOT`

### 5. Wave 1 API (Render boot fix)
- [x] Created all 5 API routers (`stocks`, `metrics`, `recommendations`, `auth`, `payments`)
- [x] Fixed `ModuleNotFoundError: No module named 'src.api.stocks'` (commit `693926a`)
- [x] `GET /api/stocks` — ETF/sector leaderboard screener (sortable, sector filter)
- [x] `GET /api/stocks/{ticker}` — multi-duration market high/low profile
- [x] `GET /api/stocks/{ticker}/chart` — 10-year daily OHLCV history (parquet)
- [x] `GET /api/metrics/breadth` + `/extremes` — market breadth aggregates
- [x] `GET /api/metrics/available` + `/metrics/{ticker}` — metrics catalog + per-ticker
- [x] `GET /api/stocks/{ticker}/similar` — decile-vector similarity recommendations
- [x] MarketHighs data committed to repo (`data/markethighs/`: detail/leaderboard/breadth + 18 parquet files)
- [x] DB init resilient (SQLite locally, Neon on Render)
- [x] All endpoints verified via TestClient (all 200 OK)
- [x] Pushed for Render auto-redeploy — **redeploy verification pending**

## In Progress

### 6. Stripe (NOT STARTED)
- [ ] Recover / confirm account access
- [ ] Create digital content product (e.g., "$9.99 Intelligence Report")
- [ ] Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Render
- [ ] Add `STRIPE_PUBLISHABLE_KEY` to Netlify
- [ ] Configure webhook after deploy: `https://api.thechasix.com/webhook/stripe`

## Pending
- [ ] Verify Render redeploy succeeds (check `https://thechasix-com.onrender.com/health`)
- [ ] GoDaddy DNS: CNAME `www` -> `thechasix-com.netlify.app`
- [ ] GoDaddy DNS: CNAME `api` -> `thechasix-com.onrender.com`
- [ ] Frontend templates + static build (screener/detail pages)
