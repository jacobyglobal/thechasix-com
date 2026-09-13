# data/watchlist

Committed data artifact for the Stock Watchlist page (`/watchlist`). Generated
by the WatchList project (`~/Documents/GeminiProjects/WatchList`) from its
shared `marketdata` package: one canonical universe +
10-year OHLCV price store feeds both the daily indicators and the
MarketHighs horizon/decile analysis, which `build_combined` merges into this
single wide table.

## Files

| File | Contents |
|------|----------|
| `watchlist.csv` | One row per ticker (46 = 45 + QQQ benchmark): base OHLCV + `Sector`, 17 WatchList indicator columns, 16 MarketHighs horizon/decile columns (per 4w/12w/26w/52w), and `composite_score` / `rank` (44 columns). |
| `column_guide.json` | Schema-v3 per-column `{name, kind, formula, meaning, recompute, view}` metadata; every column carries a `view` tag (`base` / `volatility` / `volume` / `horizon` / `jacoby`) so future view presets are declarative, plus the `_meta.views` legend. |
| `README.md` | This file. |

Deciles are on a shared **strength** scale (10 = strongest): MarketHighs' raw
`off_low_decile` (10 = nearest the low) is inverted to `11 - off_low_decile` so
`high_decile_*` and `low_decile_*` have the same polarity.

## Refresh flow

The Web UI and `GET /api/watchlist` serve these committed files verbatim - they
are never computed at request time. To refresh the data:

```bash
# 1. Fetch/refresh shared prices, then run BOTH analyses:
cd ~/Documents/GeminiProjects/WatchList      # python3 main.py (indicators via marketdata.store)
cd ~/Documents/GeminiProjects/MarketHighs    # python3 main.py (horizon/deciles via shared store)

# 2. Merge + copy the combined artifacts into this directory:
cd ~/Documents/GeminiProjects/WatchList
python3 -m marketdata.build_combined         # output/combined_watchlist.csv + combined_column_guide.json
python3 -m marketdata.sync_to_chasix         # writes BOTH files into data/watchlist/

# 3. Commit + deploy (Render rebuilds and serves the new files).
```

`data/markethighs/` is synced separately and unchanged; the homepage,
screener, stock detail, chart, and recommendation endpoints keep their format.

## Notes

- 10 years of daily OHLCV from yfinance (raw/unadjusted prices) cached as
  parquet in `WatchList/output/prices`; the watchlist indicators use the
  18-month trailing window sliced from it.
- All indicator lookbacks standardized to 21 bars, except TD Range Rank and
  Jacoby Range Index which use 52-week (252-trading-day) / multi-timeframe
  high/low lookbacks, and Jacoby Volume Profile Oscillator which uses 20- and
  252-bar synthetic VPOC windows.
- `Idiosyncratic RVOL` benchmarks each ticker's volume against the QQQ row's
  own `Relative Volume (RVOL Median)` (QQQ is itself a watchlist row).
- `Jacoby Range Index` (multi-timeframe DeMark position score) and `Jacoby
  Volume Profile Oscillator` (fast/slow VPOC migration) are documented in the
  WatchList project's `docs/columns_logic.md` and mirrored in `column_guide.json`.
- Future: expand the universe (SP500 / Nasdaq100 / Russell2000, up to ~3000
  rows) and migrate from yfinance to the Schwab API.