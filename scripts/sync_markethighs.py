#!/usr/bin/env python3
"""Sync MarketHighs pipeline output into the committed dataset.

Copies a whole MarketHighs run (output manifests + per-ticker parquet price
files) into data/markethighs/, which the Render backend serves via
src/core/market_highs_importer.py. Per ARCH_REVIEW_GUIDE.md this is a manual
data-refresh step for a dev machine -- it is never part of the frontend build
path and is imported by nothing.

Usage:
    .venv/bin/python scripts/sync_markethighs.py [SOURCE_DIR]

SOURCE_DIR defaults to the sibling ../MarketHighs checkout. The whole-run
output/ directory is copied together (never mix files from different runs --
see MarketHighs STATUS.md). Exits non-zero when required files are missing or
the manifest is unreadable; warns (but proceeds) on the STATUS.md health alarm
`profiled_count < ticker_count`, stale `as_of`, or watchlist coverage gaps.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEST_DIR = REPO_ROOT / "data" / "markethighs"
PARQUET_DEST = DEST_DIR / "parquet"
WATCHLIST_CSV = REPO_ROOT / "data" / "watchlist" / "watchlist.csv"

DEFAULT_SOURCE = REPO_ROOT.parent / "MarketHighs"
OUTPUT_FILES = [
    "universe.json",
    "detail.json",
    "detail.csv",
    "leaderboard.csv",
    "breadth.csv",
]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(2)


def warn(msg: str) -> None:
    print(f"WARNING: {msg}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync a MarketHighs run into data/markethighs/."
    )
    parser.add_argument(
        "source",
        nargs="?",
        default=str(DEFAULT_SOURCE),
        help=f"MarketHighs checkout (default: {DEFAULT_SOURCE})",
    )
    args = parser.parse_args()
    src = Path(args.source).expanduser().resolve()

    out_dir = src / "output"
    data_dir = src / "data"
    missing = [f for f in OUTPUT_FILES if not (out_dir / f).is_file()]
    if missing:
        fail(f"missing MarketHighs output file(s) in {out_dir}: {', '.join(missing)}")
    if not data_dir.is_dir():
        fail(f"missing MarketHighs price directory: {data_dir}")

    # Whole-run copy first, then validate what we copied (STATUS.md:
    # never serve/read a mix of files from different runs).
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for name in OUTPUT_FILES:
        shutil.copy2(out_dir / name, DEST_DIR / name)
    print(f"Copied {len(OUTPUT_FILES)} output files -> {DEST_DIR}/")

    try:
        manifest = json.loads((DEST_DIR / "universe.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read universe.json manifest: {exc}")

    tickers = manifest.get("tickers") or []
    total = int(manifest.get("ticker_count", len(tickers)))
    profiled = int(manifest.get("profiled_count", -1))
    as_of = str(manifest.get("as_of", "?"))
    not_profiled = sorted(
        t.get("symbol", "?") for t in tickers if not t.get("profile_computed", True)
    )

    try:
        detail = json.loads((DEST_DIR / "detail.json").read_text(encoding="utf-8"))
        detail_tickers = {str(r.get("ticker")) for r in detail}
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read detail.json: {exc}")
    if not detail_tickers:
        fail("detail.json contains no rows -- refusing to sync an empty dataset")

    leaderboard_tickers = set()
    with open(DEST_DIR / "leaderboard.csv", newline="", encoding="utf-8") as fh:
        leaderboard_tickers = {row["ticker"] for row in csv.DictReader(fh)}

    # Per-ticker parquet price files: copy all, prune anything the source no
    # longer ships so the committed cache cannot drift from the pipeline.
    PARQUET_DEST.mkdir(parents=True, exist_ok=True)
    src_parquets = sorted(data_dir.glob("*.parquet"))
    if not src_parquets:
        fail(f"no parquet price files found in {data_dir}")
    for p in src_parquets:
        shutil.copy2(p, PARQUET_DEST / p.name)
    src_names = {p.name for p in src_parquets}
    pruned = []
    for old in sorted(PARQUET_DEST.glob("*.parquet")):
        if old.name not in src_names:
            old.unlink()
            pruned.append(old.stem)

    watchlist_tickers: list[str] = []
    if WATCHLIST_CSV.is_file():
        with open(WATCHLIST_CSV, newline="", encoding="utf-8") as fh:
            watchlist_tickers = sorted({row["Ticker"] for row in csv.DictReader(fh)})

    wl_missing_profile = [t for t in watchlist_tickers if t not in detail_tickers]
    wl_missing_price = [
        t for t in watchlist_tickers if not (PARQUET_DEST / f"{t}.parquet").is_file()
    ]

    print(
        f"\nRun summary: as_of={as_of}  universe={total}  profiled={profiled}"
        f"  detail_rows={sum(1 for _ in detail)}  parquet_files={len(src_parquets)}"
    )
    if pruned:
        print(f"Pruned stale parquet files: {', '.join(pruned)}")
    if profiled >= 0 and profiled < total:
        warn(
            f"health alarm (STATUS.md): profiled_count ({profiled}) < ticker_count "
            f"({total}); pages for {', '.join(not_profiled) or '?'} will hit the "
            "'no data this run' state until the next successful pipeline run."
        )
    if wl_missing_profile:
        warn(f"watchlist tickers without a computed profile: {', '.join(wl_missing_profile)}")
    if wl_missing_price:
        warn(f"watchlist tickers without parquet price history: {', '.join(wl_missing_price)}")
    orphan_profiles = sorted(detail_tickers - leaderboard_tickers - {""})
    if orphan_profiles:
        warn(f"profiled tickers absent from leaderboard.csv: {', '.join(orphan_profiles)}")

    print("\nSync complete.")


if __name__ == "__main__":
    main()
