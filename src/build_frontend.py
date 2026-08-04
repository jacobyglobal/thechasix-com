"""Frontend build script for The ChasIX platform.

Compiles Jinja2 templates into static HTML in `dist/` for deployment on Netlify.
Wave 1 placeholder: emits a minimal landing page until templates are implemented.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import DIST_DIR, STATIC_DIR, CONTENT_DIR

PLACEHOLDER_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The ChasIX — Financial Intelligence Platform</title>
  <meta name="description" content="Finviz/Fangraphs-style market data, ETF history, and market breadth deciles." />
  <link rel="stylesheet" href="/css/style.css" />
</head>
<body>
  <header>
    <nav>
      <a class="brand" href="/">The ChasIX</a>
      <a href="/screener.html">Screener</a>
      <a href="/content/index.html">Reports</a>
    </nav>
  </header>
  <main>
    <h1>The ChasIX</h1>
    <p>Financial Intelligence Platform — under construction.</p>
  </main>
  <footer>
    <p>&copy; 2026 The ChasIX</p>
  </footer>
</body>
</html>
"""


def build() -> None:
    """Render all templates to static HTML files in dist/."""
    for directory in [DIST_DIR, STATIC_DIR / "css", STATIC_DIR / "js", DIST_DIR / "content"]:
        directory.mkdir(parents=True, exist_ok=True)

    (DIST_DIR / "index.html").write_text(PLACEHOLDER_TEMPLATE, encoding="utf-8")

    css = STATIC_DIR / "css" / "style.css"
    if css.exists():
        (DIST_DIR / "css" / "style.css").write_text(css.read_text(encoding="utf-8"), encoding="utf-8")

    js = STATIC_DIR / "js" / "main.js"
    if js.exists():
        (DIST_DIR / "js" / "main.js").write_text(js.read_text(encoding="utf-8"), encoding="utf-8")

    print(f"Build complete: {DIST_DIR}")


if __name__ == "__main__":
    build()
