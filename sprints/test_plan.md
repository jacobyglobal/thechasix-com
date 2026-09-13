# Implementation Plan — TEST-02

**Task:** Create `src/api/health.py` with a `GET /api/health` service-status endpoint and a pytest test
**Epic:** Backend Verification (PIPE-01)
**Status:** Pending

## 1. Objective
Add a `GET /api/health` service-status endpoint that is cheap, dependency-free, and **always returns 200** — so Render/UptimeRobot monitoring can probe liveness without tripping on transient DB cold-starts. It reports service identity, version, uptime, and best-effort database reachability (mirroring the "continuing without DB" resilience in `src/main.py`'s lifespan), plus a pytest suite covering status code and response shape.

## 2. Changes

### `src/api/health.py` (new — ALREADY BUILT)
- `APIRouter()` exposing `GET ""` under the `/api/health` prefix.
- Module-level `_START = time.monotonic()` and `VERSION = "0.1.0"`.
- `_check_database()` → async, runs `SELECT 1` on the shared `src.core.cache.engine`; returns `"up"`/`"down"`, **never raises** (DB failure is logged and reported as `"down"`).
- Handler returns: `{"status": "ok", "service": "thechasix-api", "version", "uptime_seconds": int, "database": "up"|"down"}`.

### `src/main.py` (edit — ALREADY DONE)
- `src/main.py:23` — import `router as health_router` from `src.api.health`.
- `src/main.py:80` — `app.include_router(health_router, prefix="/api/health", tags=["health"])`.
- Note: keep the pre-existing root `GET /health` (`src/main.py:89`) for Render's own health probe — it is redundant but harmless; do not remove it in this task.

### `src/tests/test_health.py` (new — ALREADY BUILT)
- `TestClient(app)` hitting `/api/health`.
- `test_health_returns_200` — asserts `resp.status_code == 200`.
- `test_health_shape` — asserts all five keys present; `status == "ok"`, `service == "thechasix-api"`, `uptime_seconds` is `int`, `database in ("up", "down")`.

### `dist/` (NOT required)
- Backend-only task — no `src/templates/` or `src/static/` touched, so no frontend rebuild.

## 3. Implementation Steps
1. Confirm `src/api/health.py`, the `src/main.py` wiring, and `src/tests/test_health.py` match the changes above (files already exist and are wired).
2. Verify the test suite passes: `.venv/bin/python -m pytest src/tests/test_health.py -v` (expected: 2 passed).
3. Run the full suite: `.venv/bin/python -m pytest` (per `test_queue.yaml` verify_cmd) to confirm no regressions — e.g. `main.py` import order, shared `engine` import.
4. Architecture review gate already applies to `src/api/*` additions — note in the commit (a `.opencode/reviews/` file for the health endpoint does not yet exist; if required, run `.venv/bin/python .opencode/skill/arch-review/run.py "Health Service-Status Endpoint"`).
5. Commit backend files (`src/api/health.py`, `src/main.py`, `src/tests/test_health.py`) with a conventional message (e.g., `feat: add /api/health service-status endpoint + tests (TEST-02)`).
6. `git status -sb` to confirm only intended files are staged and no stale `dist/` drift.

## 4. Definition of Done
- `GET /api/health` returns **200 OK** with `status`, `service`, `version`, `uptime_seconds`, `database` fields; DB unreachable → `"down"`, never a 5xx.
- Pytest suite (`src/tests/test_health.py`) passes; full `.venv/bin/python -m pytest` has no new failures.
- `src/api/health.py`, `src/main.py` wiring, and tests committed together; no `dist/` changes (backend-only).