"""Fetch the current S&P 500 constituents from Wikipedia.

Downloads the list and writes it to data/sp500_tickers.csv in the format:
    ticker,name,sector,industry

Uses only the standard library HTML parser (no lxml/bs4 dependency).
"""

from __future__ import annotations

import csv
from html.parser import HTMLParser
from pathlib import Path

import httpx

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
OUTPUT = Path(__file__).resolve().parent.parent / "data" / "sp500_tickers.csv"


class ConstituentsParser(HTMLParser):
    """Extract rows from the S&P 500 'constituents' table.

    The table has id="constituents" and columns:
        Symbol, Security, GICS Sector, GICS Sub-Industry, ...
    We capture the first four cells of every <tr> under that table.
    """

    def __init__(self) -> None:
        super().__init__()
        self._in_constituents = False
        self._in_row = False
        self._cells: list[str] = []
        self._cell_text: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs = dict(attrs)
        if tag == "table" and attrs.get("id") == "constituents":
            self._in_constituents = True
        if not self._in_constituents:
            return
        if tag == "tr":
            self._in_row = True
            self._cells = []
        elif tag in ("td", "th") and self._in_row:
            self._cell_text = []

    def handle_endtag(self, tag: str) -> None:
        if not self._in_constituents:
            return
        if tag in ("td", "th") and self._in_row:
            self._cells.append("".join(self._cell_text).strip())
            self._cell_text = []
        elif tag == "tr" and self._in_row:
            self._in_row = False
            if self._cells and self._cells[0]:
                self.rows.append(self._cells[:4])
        elif tag == "table":
            self._in_constituents = False

    def handle_data(self, data: str) -> None:
        if self._in_constituents and self._in_row:
            self._cell_text.append(data)


def main() -> None:
    print(f"Fetching S&P 500 constituents from Wikipedia...")
    headers = {
        "User-Agent": "TheChasIXDataBot/1.0 (https://www.thechasix.com; data pipeline for personal financial research)"
    }
    resp = httpx.get(SP500_URL, follow_redirects=True, timeout=30, headers=headers)
    resp.raise_for_status()

    parser = ConstituentsParser()
    parser.feed(resp.text)

    # First row is the header: Symbol, Security, GICS Sector, GICS Sub-Industry
    if not parser.rows:
        raise SystemExit("No constituent rows found — Wikipedia page structure may have changed.")

    header = [h.lower() for h in parser.rows[0]]
    data_rows = parser.rows[1:]

    # Rename columns to the canonical format
    col_map = {"symbol": "ticker", "security": "name", "gics sector": "sector", "gics sub-industry": "industry"}
    final_header = [col_map.get(h, h) for h in header]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(final_header)
        writer.writerows(data_rows)

    print(f"Wrote {len(data_rows)} constituents to {OUTPUT}")


if __name__ == "__main__":
    main()
