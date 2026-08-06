# Plan_WebArchitecture.md

## Goal

Permanently stop Netlify from consuming **build minutes** (free-tier limit: 300
minutes/month) so the frontend can never be blocked by the "Skipped due to
account credit usage exceeded" error again, while keeping the Render backend
(api.thechasix.com) fully functional and untouched.

## Solution: Zero-Build Netlify + Render Backend

- The static site is **built locally** (`python -m src.build_frontend`) and the
  compiled output is committed to Git (`dist/` is tracked).
- Netlify runs a **no-op build command** and just publishes the committed
  `dist/` folder. Netlify never runs Python, never installs dependencies, and
  consumes **0 build minutes**.
- Dynamic data is fetched **client-side** by JavaScript from the Render backend
  (`https://api.thechasix.com/api/...`). The watchlist, screener, and stock
  pages are already built this way; no change to data flow.

```
                     +-----------------------------+
                     |       thechasix.com         |
                     |   Netlify (static /dist)    |
                     +-----------------------------+
                             |
        static HTML/CSS/JS   |   fetch('/api/*')
                             v
                https://api.thechasix.com
             Render backend (FastAPI, heavy deps)
```

## Three Rules to Keep Netlify Build Compute Free

### Rule 1: Zero-Build Netlify (Pre-built output in Git)
- Netlify `[build] command` is a no-op (`echo ...`).
- Netlify publishes only the committed `dist/` folder.
- `dist/` is **tracked in Git** (removed from `.gitignore`).
- Frontend sources that must be rebuilt before pushing:
  - `src/templates/*` (Jinja2 templates)
  - `src/static/css/*` and `src/static/js/*`
- Rebuild command: `python -m src.build_frontend` (requires only `jinja2`).
- A versioned **pre-commit hook** (`.githooks/pre-commit`) rebuilds `dist/`
  automatically whenever those sources change, so a stale `dist/` can never be
  committed.

### Rule 2: Isolated Backend on Render
- The root `requirements.txt` stays untouched so Render's Python service keeps
  installing all backend dependencies (fastapi, pandas, etc.).
- All heavy computation, database access, and external API calls live on Render.
- **Never** add heavy packages (pandas, yfinance, DB drivers, etc.) to the
  frontend build path or to any file Netlify scans.

### Rule 3: Client-Side Asynchronous Fetching
- Static HTML shells are served instantly from the Netlify CDN.
- JavaScript fetches `https://api.thechasix.com/api/...` at runtime.
- Never bake live market data into a Netlify build.

## Files Changed

| File | Change |
|------|--------|
| `netlify.toml` | Build command becomes `echo` no-op; duplicated `[build.environment]` block removed. |
| `.gitignore` | Remove both `dist/` entries so Git tracks the pre-built site. |
| `dist/` | Now committed to Git (all rendered pages + copied assets). |
| `.githooks/pre-commit` | New versioned hook: rebuilds `dist/` when `src/templates/` or `src/static/` change, aborts commit if the build fails. |
| `AGENTS.md` | Documents the Zero-Build rule and mandatory rebuild-before-commit workflow. |
| `Plan_WebArchitecture.md` | This document. |

## Developer / Agent Workflow

1. Edit frontend sources (`src/templates/`, `src/static/`).
2. Commit — the pre-commit hook automatically runs
   `python -m src.build_frontend` and stages the updated `dist/`.
   (If the build fails, the commit is aborted.)
3. Push to `main`. Netlify publishes the committed `dist/` in ~2 seconds
   using 0 build minutes.
4. Backend changes (`src/api/`, `src/core/`, etc.) deploy via Render as before;
   `dist/` does not need to change for backend-only edits.

## Manual rebuild (if needed)

```bash
.venv/bin/python -m src.build_frontend
git add dist/
```

## Hook installation

The hook is versioned in the repo at `.githooks/pre-commit`. It is enabled per
clone with:

```bash
git config core.hooksPath .githooks
```
