"""Frontend build script for The ChasIX platform.

Renders the Jinja2 templates (src/templates/) to static HTML in `dist/`
for deployment on Netlify, and copies static assets (css/js).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from jinja2 import Environment, FileSystemLoader, select_autoescape

from src.config import DIST_DIR, STATIC_DIR, TEMPLATE_DIR

API_ROOT = "https://thechasix-com.onrender.com"

TEMPLATE_TARGETS = [
    ("index.html", "index.html"),
    ("screener.html", "screener.html"),
    ("stock_detail.html", "stock_detail.html"),
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
