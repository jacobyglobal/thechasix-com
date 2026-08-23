#!/usr/bin/env python3
"""arch-review skill runner — generates an architecture review document.

Usage:
    .venv/bin/python .opencode/skill/arch-review/run.py "<Feature Name>"
    .venv/bin/python .opencode/skill/arch-review/run.py "<Feature Name>" --open

Auto-injects the current architecture rules from AGENTS.md and
Plan_WebArchitecture.md into the compliance checklist (so rule changes in
those docs are always reflected), renders template.md, writes the result to

    .opencode/reviews/DESIGN_REVIEW_<YYYY-MM-DD>_<slug>.md

and prints it to stdout. Review files are git-ignored; all are retained.
"""

import datetime
import re
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
REPO_ROOT = SKILL_DIR.parents[2]
REVIEWS_DIR = REPO_ROOT / ".opencode" / "reviews"
TEMPLATE_PATH = SKILL_DIR / "template.md"
AGENTS_PATH = REPO_ROOT / "AGENTS.md"
PLAN_PATH = REPO_ROOT / "Plan_WebArchitecture.md"

# Used only if both reference docs are missing/unparseable, so the gate still
# produces a usable checklist.
FALLBACK_RULES = [
    ("Zero-Build Netlify: dist/ is pre-built and committed; never bake live data into static pages", "Plan_WebArchitecture.md"),
    ("Backend isolation: heavy calculation, DB, external APIs live on Render only", "Plan_WebArchitecture.md"),
    ("Client-side async fetching: static HTML shells + runtime JS fetch from the API", "Plan_WebArchitecture.md"),
    ("Frontend build stays light: stdlib + jinja2 only; no heavy deps in requirements-frontend.txt", "AGENTS.md"),
]


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "untitled-feature"


def extract_rules() -> list[tuple[str, str]]:
    """Pull architecture rules out of the reference docs.

    Returns a list of (rule_text, source) tuples. AGENTS.md contributes its
    numbered '## N.' sections; Plan_WebArchitecture.md contributes its
    '### Rule N:' headings.
    """
    rules: list[tuple[str, str]] = []

    if AGENTS_PATH.exists():
        for match in re.finditer(r"^## (\d+\.\s*.+)$", AGENTS_PATH.read_text(encoding="utf-8"), re.M):
            title = match.group(1).strip()
            rules.append((title, "AGENTS.md"))

    if PLAN_PATH.exists():
        for match in re.finditer(r"^### (Rule \d+:\s*.+)$", PLAN_PATH.read_text(encoding="utf-8"), re.M):
            title = match.group(1).strip()
            rules.append((title, "Plan_WebArchitecture.md"))

    if not rules:
        rules = FALLBACK_RULES

    # De-dupe on normalized title while preserving order.
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for text, source in rules:
        key = re.sub(r"\s+", " ", text.lower())
        if key not in seen:
            seen.add(key)
            unique.append((text, source))
    return unique


def build_compliance_table(rules: list[tuple[str, str]]) -> str:
    rows = []
    for i, (rule, source) in enumerate(rules, start=1):
        rows.append(
            f"| {i} | {rule} *(source: `{source}`)* | "
            f"*<describe how your plan does / does not comply>* | "
            f"[ ] Yes — [ ] No — [ ] N/A |"
        )
    return "\n".join(rows)


def render(feature_name: str) -> tuple[str, Path]:
    today = datetime.date.today().isoformat()
    try:
        user = (
            __import__("subprocess")
            .run(
                ["git", "config", "user.name"],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=True,
            )
            .stdout.strip()
        )
    except Exception:
        import getpass

        user = getpass.getuser()

    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    rendered = (
        template.replace("{{FEATURE_NAME}}", feature_name)
        .replace("{{DATE}}", today)
        .replace("{{USER}}", user)
        .replace("{{COMPLIANCE_TABLE}}", build_compliance_table(extract_rules()))
        .replace("{{PROPOSED_DESIGN}}", "*<fill in>*")
        .replace("{{DECISION_NOTES}}", "*<required only if deviating from current architecture>*")
    )

    REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REVIEWS_DIR / f"DESIGN_REVIEW_{today}_{slugify(feature_name)}.md"
    out_path.write_text(rendered, encoding="utf-8")
    return rendered, out_path


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 1
    feature_name = " ".join(args)

    rendered, out_path = render(feature_name)
    print(rendered)
    print(f"\n---\nReview written to: {out_path.relative_to(REPO_ROOT)}")
    print("Next: fill in Proposed Design + compliance verdicts, make a Decision, keep the file as your record.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
