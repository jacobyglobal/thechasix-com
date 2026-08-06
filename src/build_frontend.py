"""Frontend build script for The ChasIX platform.

Renders the Jinja2 templates (src/templates/) to static HTML in `dist/`
for deployment on Netlify, and copies static assets (css/js).

This script must stay isolated from the backend: it may only use the Python
standard library and `jinja2`. It must NOT import src.config or any heavy
backend package (pandas, fastapi, database drivers, etc.), so the pre-built
`dist/` output remains reproducible with only `requirements-frontend.txt`.
"""

import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

_SRC_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SRC_DIR.parent
DIST_DIR = _PROJECT_ROOT / "dist"
STATIC_DIR = _SRC_DIR / "static"
TEMPLATE_DIR = _SRC_DIR / "templates"

API_ROOT = os.getenv("API_ROOT", "https://api.thechasix.com")

TEMPLATE_TARGETS = [
    ("index.html", "index.html"),
    ("screener.html", "screener.html"),
    ("watchlist.html", "watchlist.html"),
    ("stock_detail.html", "stock.html"),
    ("pricing.html", "pricing.html"),
]


def build() -> None:
    """Render all templates to static HTML files in dist/."""
    for directory in [DIST_DIR, STATIC_DIR / "css", STATIC_DIR / "js", DIST_DIR / "css", DIST_DIR / "js", DIST_DIR / "content"]:
        directory.mkdir(parents=True, exist_ok=True)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.globals["api_root"] = API_ROOT

    for template_name, output_name in TEMPLATE_TARGETS:
        template = env.get_template(template_name)
        html = template.render()
        (DIST_DIR / output_name).write_text(html, encoding="utf-8")
        print(f"Rendered {template_name} -> dist/{output_name}")

    for asset_dir in ["css", "js"]:
        src_dir = STATIC_DIR / asset_dir
        for file in sorted(src_dir.glob("*.*")):
            (DIST_DIR / asset_dir / file.name).write_text(file.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"Copied {file.name} -> dist/{asset_dir}/")

    print(f"Build complete: {DIST_DIR}")


if __name__ == "__main__":
    build()
