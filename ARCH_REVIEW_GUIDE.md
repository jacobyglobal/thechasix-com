# Architecture Review Guide

## Why This Exists

Two recent incidents generated rework:

1. **Individual stock pages** — static `stock_NVDA.html`-style files were
   generated from another project's output (`MarketHighs`), baking live data
   into `dist/`, duplicating the existing dynamic `/stock.html?ticker=XLB`
   pattern, and coupling the frontend build to an external repo.
2. **Rollback collateral** — reverting that work also removed the News feature
   and ETF Detail page because the changes were entangled.

The arch-review gate forces a **structured double-check before new page/API
work starts**, so design decisions are validated against the documented
architecture instead of discovered after implementation.

---

## The 30-Second Version

```bash
.venv/bin/python .opencode/skill/arch-review/run.py "My Feature Name"
```

- Auto-injects current rules from `AGENTS.md` + `Plan_WebArchitecture.md`
  (re-run the skill if those docs change).
- Writes `.opencode/reviews/DESIGN_REVIEW_<date>_<slug>.md` (git-ignored; all
  reviews retained on disk) and prints the review to stdout.
- Fill in **Proposed Design**, mark each compliance row, pick a **Decision**.
- Default decision: **Follow Current Architecture** (patterns listed in the
  review). Deviating requires written justification.

---

## When to Run It

Run before starting any feature that:

- Adds pages or templates (`src/templates/*`)
- Adds API endpoints (`src/api/*`)
- Introduces a new data source or external dependency
- Changes how data reaches the user

Skip for: bug fixes, copy edits, styling tweaks, backend-only refactors with no
new endpoints, and dependency bumps.

---

## Current Architecture Patterns (Cheat Sheet)

| Need | Pattern |
|------|---------|
| New data page | `src/api/<feature>.py` endpoint + `src/templates/<feature>.html` (extends `base.html`) + `src/static/js/<feature>.js` runtime fetch |
| Detail-style page (per ticker/entity) | ONE dynamic page + query param: `/stock.html?ticker=XLB` → JS fetches `/api/stocks/XLB`. **Never** generate per-entity static files. |
| Background/nightly data | GitHub Action or Render job writes to shared DB → API serves it |
| External data source | Fetch/process on Render → store in DB → serve via API. Never read external projects at build time. |

### Anti-Patterns That Triggered This Gate

| Anti-Pattern | Why It Breaks |
|--------------|---------------|
| Static per-ticker pages (`stock_NVDA.html`) | Bakes data into `dist/`; unbounded file growth; duplicates the dynamic detail-page pattern |
| Reading another project's output at build time (`MarketHighs`) | Couples frontend build to external repo; not reproducible on Netlify (0-build) |
| Heavy deps in the frontend build path | Netlify auto-installs anything it detects → burns build minutes |
| Bypassing Render / shared DB | Splits source of truth; CORS + auth complexity |

---

## The Pre-Commit Warning

`.githooks/pre-commit` (enabled via `git config core.hooksPath .githooks`)
prints a **non-blocking warning** when NEW files under `src/templates/*.html`
or `src/api/*.py` are staged while `.opencode/reviews/` contains no
`DESIGN_REVIEW_*.md`.

```
WARNING: New template/API file(s) staged without an architecture review:
  - src/templates/foo.html
Run: .venv/bin/python .opencode/skill/arch-review/run.py "<Feature Name>"
(Non-blocking — commit will proceed. See ARCH_REVIEW_GUIDE.md.)
```

It is advisory by design: it catches drift without blocking hotfixes. If you
see it, run the skill and note the review in your commit message.

> Hook scope is intentionally limited to **new** files for now. Modified
> templates/endpoints do not trigger the warning.

---

## Review File Lifecycle

- **Location:** `.opencode/reviews/` — git-ignored, never committed.
- **Naming:** `DESIGN_REVIEW_YYYY-MM-DD_<slug>.md`
  (e.g., `DESIGN_REVIEW_2026-08-22_watchlist-stock-detail-pages.md`).
- **Retention:** all files kept; nothing is overwritten. Re-running the same
  feature name on the same day appends `-1`, `-2`, ... only if you extend
  `run.py`; by default a same-day rerun overwrites the identical filename —
  rename manually if you need to preserve iterations.

---

## Worked Example: Watchlist Stock Detail Pages (the incident)

**Proposed:** generate `dist/stock_sndk.html`, `dist/stock_nvda.html`, ... from
MarketHighs project output.

**Review outcome if run at the time:**

- ❌ Bakes live data into static `dist/` → violates Zero-Build Netlify
- ❌ Reads external project at build time → violates backend isolation
- ❌ Per-ticker static files → anti-pattern; site already has
  `/stock.html?ticker=XLB` fetching `/api/stocks/<ticker>`
- ✅ Correct approach: ensure watchlist tickers exist in the Render DB /
  universe; reuse the existing dynamic detail page — likely zero new code.

---

## Files Reference

| File | Role |
|------|------|
| `AGENTS.md` | Project constraints & architecture rules (source of truth) |
| `Plan_WebArchitecture.md` | Architecture rationale & three rules |
| `.opencode/skill/arch-review/skill.json` | Skill metadata |
| `.opencode/skill/arch-review/template.md` | Review document template |
| `.opencode/skill/arch-review/run.py` | Runner: extracts rules, renders, writes review |
| `.githooks/pre-commit` | Rebuilds `dist/`; prints advisory review warning |
| `ARCH_REVIEW_GUIDE.md` | This guide |

---

## Setup Notes

The pre-commit hook must be enabled once per clone (already enabled here):

```bash
git config core.hooksPath .githooks
```
