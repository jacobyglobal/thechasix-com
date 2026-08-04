# The ChasIX — Setup Status Tracker

Last updated: 2026-08-03

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
  - [ ] `STRIPE_SECRET_KEY` (pending Stripe setup)
  - [ ] `STRIPE_WEBHOOK_SECRET` (pending Stripe webhook)
  - [ ] `SECRET_KEY` (generate random 32-char string)
  - [ ] `FRONTEND_URL` = `https://www.thechasix.com`

## In Progress

### 4. Netlify Site
- [x] Account created via GitHub
- [x] Import repo `thechasix-com`
- [x] Build command: `python -m src.build_frontend`
- [x] Publish directory: `dist/`
- [x] First production deploy succeeded (2026-08-03, commit `0261294`)
- [x] Site URL: https://boisterous-rabanadas-45ce33.netlify.app
- [ ] Environment variables: `STRIPE_PUBLISHABLE_KEY`, `API_ROOT`

### 5. Stripe
- [ ] Recover / confirm account access
- [ ] Create digital content product (e.g., "$9.99 Intelligence Report")
- [ ] Add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` to Render
- [ ] Add `STRIPE_PUBLISHABLE_KEY` to Netlify
- [ ] Configure webhook after deploy: `https://api.thechasix.com/webhook/stripe`

## Pending
- [ ] GoDaddy DNS: CNAME `www` -> `thechasix-com.netlify.app`
- [ ] GoDaddy DNS: CNAME `api` -> `thechasix-com.onrender.com`
- [ ] Wave 1 code implementation (data importer, models, endpoints, templates)
