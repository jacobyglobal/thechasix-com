# Implementation Plan — TEST-01

**Task:** Add default meta title, description, and Open Graph tags to `src/templates/base.html`
**Epic:** Frontend Verification (SEO-01)
**Status:** Pending

## 1. Objective
Add default (non-unique) SEO metadata to `src/templates/base.html` so every page ships a complete, socially-shareable `<head>`: meta title, meta description, Open Graph tags (`og:*`), and Twitter Card tags. All values are overridable per-page via Jinja2 blocks so child templates can later supply unique `SEO-01` metadata. No backend code or API changes.

## 2. Changes

### `src/templates/base.html` (edit)
Current state: `title` and `description` blocks already exist (defaults added in `668ef2e`); the full OG/Twitter block set is **already written but uncommitted** in the working tree. Changes to commit:
- **Meta title** — keep existing default: `<title>{% block title %}The ChasIX — Financial Intelligence Platform{% endblock %}</title>` (~30 chars, includes brand).
- **Meta description** — keep existing default block: *"Financial intelligence platform providing ETF market highs, sector breadth metrics, and stock market analytics."* (~90–120 chars, has CTA keywords).
- **Open Graph tags** — `og:site_name="The ChasIX"`; `og:title`/`og:description` default to the page `title`/`description` via `{{ self.title() }}` / `{{ self.description() }}`; `og:type=website`; `og:url` default `https://thechasix.com`; `og:image` default `https://thechasix.com/og-image.png` — each wrapped in its own `{% block %}` (e.g. `og_title`, `og_url`, `og_image`) for per-page override.
- **Twitter Card tags** — `twitter:card=summary_large_image`, `twitter:title`/`twitter:description` default to `self.title()`/`self.description()`, `twitter:image` defaults to `self.og_image()`; each in its own block.
- **Note / follow-up (out of scope)**: `og:image` references an `og-image.png` that does not yet exist on the host — create it or point at an existing branded asset in a later task before social previews go live. Same for a per-page `canonical` tag (SEO-01 cleanup), which is not part of this default-tags task.

### Child templates (no change required for this task)
- Already override `title`/`description`: `stock_detail.html`, `calculator.html`, `news.html`, `watchlist.html`, `index.html` (title only), `screener.html` (title only), `pricing.html` (title only).
- Pages without a custom `description` fall back to the `base.html` default — acceptable for TEST-01; unique per-page copy is the SEO-01 follow-up.

### `dist/` (regenerate — REQUIRED)
- This task touches `src/templates/`, so `dist/` must be rebuilt and committed in the same commit (zero-build Netlify publishes `dist/`).
- Verify: `.venv/bin/python -m src.build_frontend`

## 3. Implementation Steps
1. Confirm `src/templates/base.html` `<head>` contains the full meta block set (title, description, `og:site_name/title/description/type/url/image`, `twitter:card/title/description/image`) — edit if the uncommitted working-tree version is incomplete.
2. Rebuild `dist/`: `.venv/bin/python -m src.build_frontend`.
3. Spot-check rendered output in `dist/index.html` (and one child page) that the default tags appear and child overrides win.
4. Commit all `src/templates/base.html` + `dist/*` changes together with a conventional message (e.g., `feat: add default meta + Open Graph/Twitter tags to base template (TEST-01)`).
5. `git status -sb` to confirm no stale uncommitted `dist/`.

## 4. Definition of Done
- `base.html` ships default `<title>`, `<meta name="description">`, Open Graph (`og:*`), and Twitter Card tags, each in an overridable Jinja2 block.
- Rendered `dist/` includes the defaults and preserves child-template overrides.
- `dist/` rebuilt via `.venv/bin/python -m src.build_frontend` and committed in the same commit as the template change.
- No backend/API files touched; `dist/` remains in sync with sources.