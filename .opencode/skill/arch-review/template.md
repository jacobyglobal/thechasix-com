# Architecture Review: {{FEATURE_NAME}}

**Date:** {{DATE}}
**Reviewer:** {{USER}}
**Status:** [ ] Draft — [ ] Decided

---

## Proposed Design

*Describe the feature before writing code: goal, data source(s), data flow,
files to create/modify, external dependencies, and how results reach the user.*

{{PROPOSED_DESIGN}}

---

## Architecture Compliance Check

*Rules below were auto-injected from AGENTS.md and Plan_WebArchitecture.md on
{{DATE}}. If these docs have changed since, re-run the skill to refresh.*

| # | Rule (source) | Does the proposed design comply? | Verdict |
|---|---------------|----------------------------------|---------|
{{COMPLIANCE_TABLE}}

---

## Recommendation

### Follow Current Architecture (default)

Reuse the site's established patterns — no new architecture:

- **API:** add an endpoint in `src/api/<feature>.py`, register it in `src/main.py`.
- **Data:** fetch/process on Render (nightly GitHub Action or on-demand); store
  in the shared database; serve via the API.
- **Frontend:** add a template in `src/templates/<feature>.html` extending
  `base.html`; add JS in `src/static/js/<feature>.js` that calls
  `fetch(window.API_ROOT + "/api/...")` at runtime.
- **Detail-style pages:** use one dynamic page + query param
  (`/stock.html?ticker=XLB`) — never generate per-ticker static files.
- **Build:** commit source changes; the pre-commit hook rebuilds `dist/`.

### Original Plan (requires justification)

*Summarize the initially proposed approach here, if different from the above.*

**Architecture violations detected:**

- [ ] Bakes live data into static `dist/` (breaks Zero-Build Netlify)
- [ ] Reads from an external project (e.g., MarketHighs) at build time
- [ ] Adds heavy dependencies to the frontend build path
- [ ] Generates per-ticker / per-entity static files instead of dynamic fetch
- [ ] Bypasses the Render backend or shared database
- [ ] Other: ________________________________________________

---

## Decision

Choose exactly one:

- [ ] **Follow Current Architecture** — implement using the patterns above.
- [ ] **Original Plan** — proceed despite violations.

**Justification (required if Original Plan chosen):**

{{DECISION_NOTES}}

---

## Next Steps (if Following Current Architecture)

1. [ ] Backend endpoint: `src/api/<feature>.py` (+ register in `src/main.py`)
2. [ ] Data pipeline writes to shared DB (Render job / GitHub Action)
3. [ ] Template: `src/templates/<feature>.html` extends `base.html`
4. [ ] Frontend JS: `src/static/js/<feature>.js`, runtime fetch only
5. [ ] Commit — pre-commit hook rebuilds and stages `dist/`
6. [ ] Push: Netlify publishes static, Render deploys API

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Reviewer | {{USER}} | {{DATE}} |
