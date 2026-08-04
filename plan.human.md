# The ChasIX — Strategic Overview & Human Action Plan

## Vision
Transform thechasix.com into **The ChasIX — Financial Intelligence Platform**: a zero-cost bootstrapped site offering Finviz/Fangraphs-style market data, 10-year ETF stock history, and sector market high/low decile rankings. Monetized initially through **one-time digital content sales** (reports, datasets) and later through recurring subscriptions.

## Business Model & Pricing Tiers

| Tier / Feature | Price | Access | Contents |
|----------------|-------|--------|----------|
| Free Tier | $0 | Public | Market high/low decile screeners, 10-year ETF performance history, basic charts |
| Digital Content Sales | $4.99 - $19.99 / item | One-time Stripe Checkout | Custom sector deep dive PDF reports, raw intelligence datasets, downloadable CSVs |
| Pro Subscription (Phase 2) | $9.99 / month | Recurring Stripe | Full API access, unlimited premium downloads, priority recommendations |

## Architecture Summary

```
User visits thechasix.com
   │
   ├── Netlify CDN (static HTML, CSS, JS, charts) — $0/month
   │   Serves all static content from edge locations
   │   No cold starts, instant page loads
   │
   ├── api.thechasix.com (Render Hobby — $0/month)
   │   Python FastAPI backend: API endpoints, Stripe webhooks
   │   Reads from Neon PostgreSQL cache
   │
   └── Neon PostgreSQL — $0/month
       Stores: 10-year ETF stock history, MarketHighs deciles, stock metrics, digital content orders

Nightly:
GitHub Actions (2 AM EST) -> MarketHighs / yfinance -> Neon PostgreSQL
```

## Cost Structure

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Render Hobby | $0 | Free tier: 750 hrs, 5 GB bandwidth |
| Neon PostgreSQL | $0 | Free tier: 3 GB storage |
| Netlify | $0 | Free tier: ~30 GB bandwidth |
| GitHub Actions | $0 | Free tier: 2,000 min/month |
| Stripe fees | 2.9% + 30¢ | Pay-per-sale (zero base cost) |
| GoDaddy domain | ~$10/year | Already owned (thechasix.com) |
| **Total Base Cost** | **$0 / month** | Self-funded & zero liability until revenue generated |

## Roadmap

```
Wave 1 | MVP — Market Highs & ETF History | Live ETF screener + decile rankings + static build
Wave 2 | Monetization — Digital Content  | Stripe Checkout for one-time digital reports & downloads
Wave 3 | Recommendations & Analytics     | Duration decile similarity engine + SEO + sitemap
Wave 4 | Pro Subscriptions & User Portal | Optional account registration + $9.99/mo subscription
```

## Human Tasks Checklist (Your Steps)

### Step 1: GitHub Repository Setup
- [ ] Log into GitHub -> Create new public repository named `thechasix-com`
- [ ] Leave uninitialized (no README)

### Step 2: Stripe Account Credentials
- [ ] Log into Stripe Dashboard
- [ ] Go to **Developers -> API Keys**: Note `Publishable Key` and `Secret Key`
- [ ] Create 1 Digital Content product in Stripe Dashboard (e.g. "$9.99 Intelligence Report")

### Step 3: Platform Sign-ups (Free Tiers)
- [ ] **Render**: Sign up at https://render.com via GitHub
- [ ] **Netlify**: Sign up at https://netlify.com via GitHub
- [ ] **Neon**: Sign up at https://neon.tech via GitHub -> Create project `thechasix-db` -> Copy connection string

### Step 4: Environment Variables Setup
- [ ] Add `DATABASE_URL`, `STRIPE_SECRET_KEY` on Render
- [ ] Add `STRIPE_PUBLISHABLE_KEY`, `API_ROOT` on Netlify

### Step 5: GoDaddy DNS Configuration
- [ ] CNAME `www` -> `thechasix-com.netlify.app`
- [ ] CNAME `api` -> `thechasix-api.onrender.com`
- [ ] Point Stripe Webhook to `https://api.thechasix.com/webhook/stripe`

## OpenCode Free Model Usage & Quota Guidelines

To avoid hitting rate limits or consuming excessive tokens during OpenCode sessions:

1. **Lightweight Iterative Coding (Frontend / Python / SQL)**:
   - Use `google/gemini-2.5-flash-lite` in your OpenCode configuration for high speed and minimal quota consumption.
2. **System Planning & Architecture Review**:
   - Use `google/gemini-3.6-flash` when making high-level decisions or reading large multi-file contexts.
3. **Quota / Timeout Fallbacks**:
   - If Gemini models hit rate limits or time out, switch to `opencode/big-pickle` or `opencode/nemotron-3-ultra-free`.
4. **Laguna Agents Strategy**:
   - Save Laguna multi-agent sessions for complex multi-file feature builds to avoid depleting daily quota limits prematurely.


