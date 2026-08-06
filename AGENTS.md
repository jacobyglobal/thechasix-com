# Project Constraints & Architecture Rules

## 1. Deployment Architecture
- **Netlify (Frontend Static Host) — ZERO-BUILD:**
  - Netlify publishes the **pre-built `dist/` folder committed to Git**; its build command is a no-op (`echo`). Netlify must never run Python or install dependencies, so it consumes **0 build minutes** and can never hit the 300-minute/month limit.
  - `dist/` is tracked in Git. Do NOT add `dist/` back to `.gitignore`.
  - Do NOT add heavy data-science or backend packages (`pandas`, `yfinance`, database drivers, etc.) to any frontend build requirements.
- **Render (Backend Web Service):**
  - All heavy Python calculations, Schwab API calls, database interactions, and background worker jobs must live on Render (`api.thechasix.com`).
  - Backend dependencies live in **`requirements-backend.txt`** (referenced by `render.yaml` and the nightly GitHub Actions workflow). A root `requirements.txt` must NEVER exist — Netlify auto-detects it and would pip-install the entire backend stack on every deploy.

## 2. Frontend Build Rules — MANDATORY REBUILD-BEFORE-COMMIT
- **Rule:** Whenever you modify any file in `src/templates/` or `src/static/`, you MUST run `python -m src.build_frontend` and stage/commit the updated `dist/` folder in the SAME commit. Never push source changes without an updated `dist/` — otherwise Netlify deploys stale assets.
- Rebuild command: `.venv/bin/python -m src.build_frontend` (requires only `jinja2`, from `requirements-frontend.txt`).
- The versioned pre-commit hook (`.githooks/pre-commit`, enabled via `git config core.hooksPath .githooks`) enforces this automatically: it rebuilds `dist/` when frontend sources change and aborts the commit if the build fails.
- `src.build_frontend` must rely exclusively on built-in Python libraries or ultra-light template engines (e.g., `jinja2`) without touching heavy external data dependencies. It must NOT import `src.config` or any backend package.

## 3. Code Organization
- Frontend layout templates and static assets go in `src/templates/` and `src/static/`; compiled output goes to `dist/` (committed).
- Backend API endpoints, data processing, and external API requests must be routed through the Render backend code structure.