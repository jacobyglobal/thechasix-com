# Local Project Blueprint & Agent Instructions: TheChasIX.com

## Workspace Context & Sandboxing Rules
- **Project Root Directory:** `/Users/christopher.jacoby/Documents/GeminiProjects/TheChasIX.com`
- **Execution Rule:** All paths must be evaluated relative to this project root directory.
- **Strict Sandboxing:** You must NOT read, modify, or inspect any files outside of this project root directory.

## Directory Structure Overview
- `sprints/`: Contains active sprint backlogs (`sprint_queue.yaml`) and temporary execution plans (`test_plan.md`).
- `src/templates/`: Jinja2/HTML templates for site views (e.g., `tools.html`, `index.html`).
- `src/static/js/`: Client-side JavaScript assets, watchlists, and dynamic rendering modules.
- `src/api/`: FastAPI backend routes and API endpoint logic.
- `dist/`: Pre-built published frontend assets (Zero-Build Netlify distribution output).

## Build & Test Standards
1. **Python Environment:** Always use explicit Python 3 commands (`python3`).
2. **Frontend Build Verification:** Execute `python3 -m src.build_frontend` whenever files in `src/templates/` or `src/static/` are created or modified.
3. **Backend Testing:** Execute `pytest` when modifications touch API routes inside `src/api/`.

## Phase-Gated Execution Workflow
When invoked by `scrumMaster_runner.py`, perform tasks strictly according to the phase instructed in the prompt:

### Phase 1: Planning Mode
- Read the assigned task prompt and inspect relevant codebase files.
- Formulate a clear, step-by-step implementation strategy.
- Write your concise plan to `sprints/test_plan.md`.
- **Constraint:** Do NOT modify source code files during Phase 1.

### Phase 2: Building Mode
- Read `sprints/test_plan.md` to review the execution steps.
- Implement all required code changes in the target project files.
- Ensure all added comments or code comply with Python 3 standards and existing file formatting.