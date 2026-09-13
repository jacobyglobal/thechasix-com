# Sprint 1 Execution Plan: Growth, Screener Core, Automation & Monetization

## Objective
Execute Sprint 1 of The ChasIX platform, focusing on organic traffic acquisition (SEO & referrals), core screener power, automated nightly data ingestion pipelines, Stripe checkout digital commerce integration, and competitive/strategic assessment.

## Architecture Compliance
- **Frontend (`src/templates/`, `src/static/`):** Zero-build Netlify publishing pre-built `dist/`. Mandatory local rebuild (`python -m src.build_frontend`) before commit; pre-commit hook enforces this.
- **Backend (`src/api/`, `src/core/`, etc.):** Python FastAPI running on Render (`api.thechasix.com`), powered by Neon PostgreSQL. Dependencies isolated in `requirements-backend.txt`.

## Sprint 1 Task Breakdown

### Epic 1: SEO & Referral Traffic Acquisition
- [ ] **SEO-01**: Implement unique page-level meta titles, descriptions, and Open Graph tags across templates.
- [ ] **SEO-02**: Implement automated `sitemap.xml` generation script (to run nightly via GitHub Actions).
- [x] **REF-05**: Prepared referral directory JSON data files (`data/referral_tools.json`, `data/referral_books.json`).
- [ ] **REF-01 / REF-02**: Build `/tools` and `/books` referral directory pages (`src/templates/tools.html`, `src/templates/books.html`).
- [ ] **REF-03 / REF-04**: Add FTC-compliant affiliate disclosures, UTM tracking parameters, and footer/nav links.

### Epic 2: Screener & Data Intelligence Core
- [ ] **SCR-01**: Add CSV/JSON export button for currently filtered and sorted screener rows.
- [ ] **SCR-07 & SCR-08**: Implement asset-type segmented filter buttons (ETF/Stock/All) and GICS/NAICS sector taxonomy migration.
- [ ] **HOME-03**: Build "Movers-Today" decile change strip on the homepage.

### Epic 3: Data Pipeline Automation & Scheduling
- [ ] **PIPE-01**: Build automated nightly ingestion script (GitHub Actions workflow / Render worker) for MarketHighs data updates, with failure alerting and health status endpoints.

### Epic 4: Stripe Monetization & Digital Commerce Architecture
- [ ] **PAY-01 to PAY-04**: Implement FastAPI endpoints for Stripe Checkout session creation, secure webhook verification (`/webhook/stripe`), signed download token generation (1-hour expiration), and test suite verification.
- [ ] **PRICING-01**: Implement free-tier data gates and dynamic paywalls on premium CSV/report downloads.

### Epic 5: Competitive Intelligence & Strategic Assessment
- [ ] **STRAT-01**: Draft the comprehensive broker API authentication/sync GTM strategy, SWOT analysis, and trading tools competitive assessment document.
