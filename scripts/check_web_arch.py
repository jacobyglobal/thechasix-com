#!/usr/bin/env python3
"""Static compliance gate for the The ChasIX web architecture.

Zero-dependency (stdlib-only) checker for the Zero-Build Netlify + Render
architecture. Designed to be called by an agentic orchestration flow or any
sub-agent; it returns exit code 0 when every rule is satisfied and 1
otherwise, printing the failing checks to stdout.

Usage:
    python scripts/check_web_arch.py
    python scripts/check_web_arch.py --list
    python scripts/check_web_arch.py --expected-api-root https://api.thechasix.com

The rule set enforced here is documented in sprints/webArchRules.md. Each
check name maps 1:1 to a rule in that document, so an orchestrator can map a
failing check straight back to the "how to fix" section.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_API_ROOT = "https://api.thechasix.com"

HEAVY_FRONTEND_PKGS = (
    "pandas",
    "yfinance",
    "numpy",
    "scikit",
    "sqlalchemy",
    "asyncpg",
    "psycopg2",
    "stripe",
    "fastapi",
    "uvicorn",
    "gunicorn",
    "plotly",
    "weasyprint",
    "aiosqlite",
    "aiofiles",
)

LOCALHOST_PATTERNS = (
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "http://[",
)

PER_ENTITY_STATIC = re.compile(r"^(stock|etf)_[A-Z]{1,6}\.html$", re.IGNORECASE)

IGNORED_GITIGNORE_LINES = (
    "#",  # comment
    "!",  # negation
    "",  # blank
)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def _git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], capture_output=True, text=True, cwd=ROOT, check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return ""


# ---- Individual checks ------------------------------------------------------
# Each check returns (ok: bool, violation: str | None). A violation message is
# human-readable and tells the orchestrator what is wrong and how to fix it.

def check_root_requirements_absent() -> tuple[bool, str | None]:
    if (ROOT / "requirements.txt").exists():
        return False, "Root requirements.txt exists. Netlify auto-detects it and would pip-install the entire backend stack, burning build minutes. Rename/merge it into requirements-backend.txt."
    return True, None


def check_dependency_split() -> tuple[bool, str | None]:
    problems = []
    backend = ROOT / "requirements-backend.txt"
    frontend = ROOT / "requirements-frontend.txt"
    if not backend.exists():
        problems.append("requirements-backend.txt is missing (Render + nightly workflow depend on it).")
    if not frontend.exists():
        problems.append("requirements-frontend.txt is missing (local dist/ rebuilds depend on it).")
    if (ROOT / "requirements.txt").exists():
        problems.append("Root requirements.txt must not exist; backend deps belong in requirements-backend.txt.")
    return (not problems, "; ".join(problems) if problems else None)


def check_frontend_requirements_light() -> tuple[bool, str | None]:
    path = ROOT / "requirements-frontend.txt"
    if not path.exists():
        return False, "requirements-frontend.txt is missing."
    text = _read(path)
    heavy = [pkg for pkg in HEAVY_FRONTEND_PKGS if re.search(rf"^\s*{re.escape(pkg)}\b", text, re.MULTILINE)]
    if heavy:
        return False, f"Heavy backend packages found in requirements-frontend.txt: {', '.join(heavy)}. Frontend build deps must stay ultra-light (jinja2 only)."
    return True, None


def check_dist_tracked_in_git() -> tuple[bool, str | None]:
    gi = ROOT / ".gitignore"
    if not gi.exists():
        return True, None  # no .gitignore => nothing ignoring dist
    for line in _read(gi).splitlines():
        stripped = line.strip()
        if stripped in IGNORED_GITIGNORE_LINES:
            continue
        if stripped in ("dist", "dist/", "/dist", "/dist/"):
            return False, f".gitignore line '{stripped}' excludes dist/ but dist/ MUST be tracked so Netlify can publish it."
    return True, None


def check_netlify_zero_build() -> tuple[bool, str | None]:
    cfg = ROOT / "netlify.toml"
    if not cfg.exists():
        return False, "netlify.toml is missing (Netlify zero-build config lives there)."
    text = _read(cfg)
    problems = []
    if any(word in text for word in ("pip install", "pip ", "python -m", "python ", "npm install", "yarn", "make ")):
        problems.append("netlify.toml build command looks like it executes real build steps; it must be a no-op (echo) so Netlify consumes 0 build minutes.")
    if 'publish = "dist"' not in text:
        problems.append("netlify.toml [build].publish must be 'dist' (Netlify publishes the committed pre-built folder).")
    return (not problems, "; ".join(problems) if problems else None)


def check_no_localhost_in_dist(expected_root: str) -> tuple[bool, str | None]:
    dist = ROOT / "dist"
    if not dist.exists():
        return False, "dist/ is missing. Run .venv/bin/python -m src.build_frontend and commit the output."
    hits = []
    for path in sorted([*dist.glob("*.html"), *dist.glob("js/*.js")]):
        text = _read(path)
        for pat in LOCALHOST_PATTERNS:
            if pat in text:
                hits.append(f"{path.relative_to(ROOT)} contains '{pat}'")
    if hits:
        return False, "Compiled assets point at a local/loopback endpoint: " + "; ".join(hits) + ". Rebuild with API_ROOT=https://api.thechasix.com and confirm nothing local remains."
    pages = sorted(dist.glob("*.html"))
    if pages and expected_root and not any(expected_root in _read(p) for p in pages):
        return False, f"No compiled page references the expected production API root '{expected_root}'. Rebuild with API_ROOT={expected_root}."
    return True, None


def check_no_per_entity_static_pages() -> tuple[bool, str | None]:
    dist = ROOT / "dist"
    if not dist.exists():
        return True, None
    hits = [str(p.relative_to(ROOT)) for p in dist.glob("*.html") if PER_ENTITY_STATIC.match(p.name)]
    if hits:
        return False, "Static per-entity pages found: " + ", ".join(hits) + ". Use one dynamic page with a query param (e.g. /stock.html?ticker=NVDA) that fetches data at runtime."
    return True, None


def check_build_frontend_isolated() -> tuple[bool, str | None]:
    path = ROOT / "src" / "build_frontend.py"
    if not path.exists():
        return False, "src/build_frontend.py is missing."
    text = _read(path)
    bad_imports = [
        line.strip()
        for line in text.splitlines()
        if line.strip().startswith(("import src.config", "from src.config"))
        or re.search(r"^\s*(import|from)\s+(pandas|numpy|yfinance|sqlalchemy|fastapi)", line)
    ]
    if bad_imports:
        return False, "src/build_frontend.py imports backend/heavy modules: " + "; ".join(bad_imports) + ". It must rely only on stdlib + jinja2."
    return True, None


def check_precommit_hook_configured() -> tuple[bool, str | None]:
    hook = ROOT / ".githooks" / "pre-commit"
    if not hook.exists():
        return False, ".githooks/pre-commit is missing; the hook must exist and be enabled to auto-rebuild dist/."
    actual = _git("config", "core.hooksPath")
    if actual != ".githooks":
        return False, f"git core.hooksPath is '{actual or '<unset>'}' — run 'git config core.hooksPath .githooks' so dist/ is auto-rebuilt on commit."
    return True, None


CHECKS: tuple[tuple[str, str, object], ...] = (
    ("root_requirements_absent", "Root requirements.txt is banned", check_root_requirements_absent),
    ("dependency_split", "Backend deps in requirements-backend.txt, frontend in requirements-frontend.txt", check_dependency_split),
    ("frontend_requirements_light", "requirements-frontend.txt stays ultra-light (jinja2 only)", check_frontend_requirements_light),
    ("dist_tracked_in_git", "dist/ is tracked in Git (not in .gitignore)", check_dist_tracked_in_git),
    ("netlify_zero_build", "Netlify build is a no-op publishing dist/", check_netlify_zero_build),
    ("no_localhost_in_dist", "dist/ points at the production API, never localhost", check_no_localhost_in_dist),
    ("no_per_entity_static_pages", "No static per-entity pages (stock_NVDA.html anti-pattern)", check_no_per_entity_static_pages),
    ("build_frontend_isolated", "src/build_frontend.py uses only stdlib + jinja2", check_build_frontend_isolated),
    ("precommit_hook_configured", "Pre-commit hook enabled via core.hooksPath", check_precommit_hook_configured),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="List checks without running them")
    parser.add_argument("--expected-api-root", default=DEFAULT_API_ROOT, help="Expected production API root baked into dist/")
    args = parser.parse_args()

    if args.list:
        for name, desc, _ in CHECKS:
            print(f"{name:<32} {desc}")
        return 0

    failures = []
    for name, desc, fn in CHECKS:
        if name == "precommit_hook_configured" and os.environ.get("CWA_SKIP_GIT_HOOK"):
            print(f"[SKIP] {name:<32} {desc} (CWA_SKIP_GIT_HOOK=1 — CI checkouts don't set hooksPath)")
            continue
        ok, violation = fn(args.expected_api_root) if name == "no_localhost_in_dist" else fn()
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name:<32} {desc}")
        if not ok:
            failures.append(violation or name)

    if failures:
        print("\nArchitecture violations detected:")
        for i, f in enumerate(failures, 1):
            print(f"  {i}. {f}")
        print("\nFix the violations, then re-run this script. See sprints/webArchRules.md for the rules.")
        return 1
    print("\nAll web architecture rules satisfied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())