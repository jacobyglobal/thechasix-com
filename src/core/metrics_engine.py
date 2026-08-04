"""Metrics engine for computing stock valuations and unique composite scores.

Follows the pattern from MarketHighs/analysis.py — deterministic,
testable with synthetic data, no external dependencies beyond pandas/numpy.
"""

import logging
from typing import Any
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Standard fundamental metrics computed from Schwab quote + fundamental data
BASELINE_METRICS = [
    "pe_ratio",
    "pb_ratio",
    "ev_ebitda",
    "fcf_yield",
    "market_cap",
    "dividend_yield",
    "debt_equity",
    "roe",
    "beta",
    "revenue_growth",
]


def safe_divide(numerator: float, denominator: float) -> float:
    """Division that returns NaN instead of raising on zero."""
    if denominator == 0 or denominator is None or pd.isna(denominator):
        return float("nan")
    return numerator / denominator


def compute_pe_ratio(quote: dict[str, Any]) -> float:
    """Price-to-Earnings ratio = Market Cap / Net Income (or Price / EPS)."""
    price = quote.get("quote", {}).get("lastPrice", 0)
    pe = quote.get("fundamental", {}).get("peRatio", None)
    if pe is not None:
        return pe
    eps = quote.get("fundamental", {}).get("eps", 0)
    return safe_divide(price, eps) if eps else float("nan")


def compute_pb_ratio(quote: dict[str, Any]) -> float:
    """Price-to-Book ratio = Price / Book Value per Share."""
    price = quote.get("quote", {}).get("lastPrice", 0)
    pb = quote.get("fundamental", {}).get("pricePerShare", 0)
    book = quote.get("fundamental", {}).get("bookValuePerShare", 0)
    if pb and book:
        return safe_divide(pb * price, book)
    return safe_divide(price, book) if book else float("nan")


def compute_ev_ebitda(quote: dict[str, Any]) -> float:
    """Enterprise Value / EBITDA."""
    ev = quote.get("fundamental", {}).get("ev", 0)
    ebitda = quote.get("fundamental", {}).get("ebitda", 0)
    return safe_divide(ev, ebitda) if ev and ebitda else float("nan")


def compute_fcf_yield(quote: dict[str, Any]) -> float:
    """Free Cash Flow Yield = FCF / Market Cap."""
    fcf = quote.get("fundamental", {}).get("freeCashFlow", 0)
    market_cap = quote.get("quote", {}).get("totalVolume", 0)  # fallback
    market_cap = quote.get("fundamental", {}).get("marketCap", market_cap)
    return safe_divide(fcf, market_cap) if fcf and market_cap else float("nan")


def compute_dividend_yield(quote: dict[str, Any]) -> float:
    """Dividend Yield = Annual Dividend / Price."""
    price = quote.get("quote", {}).get("lastPrice", 0)
    annual_div = quote.get("fundamental", {}).get("dividendYield", 0)
    if annual_div and price:
        return annual_div  # Schwab returns yield directly
    return float("nan")


def compute_debt_equity(quote: dict[str, Any]) -> float:
    """Debt-to-Equity ratio."""
    total_debt = quote.get("fundamental", {}).get("totalDebt", 0)
    equity = quote.get("fundamental", {}).get("totalShareholderEquity", 0)
    return safe_divide(total_debt, equity) if total_debt and equity else float("nan")


def compute_roe(quote: dict[str, Any]) -> float:
    """Return on Equity = Net Income / Total Shareholder Equity."""
    net_income = quote.get("fundamental", {}).get("netIncome", 0)
    equity = quote.get("fundamental", {}).get("totalShareholderEquity", 0)
    return safe_divide(net_income, equity) if net_income and equity else float("nan")


def compute_beta(quote: dict[str, Any]) -> float:
    """Beta (volatility relative to market)."""
    beta = quote.get("fundamental", {}).get("beta", None)
    return float(beta) if beta is not None else float("nan")


def compute_revenue_growth(quote: dict[str, Any]) -> float:
    """Revenue growth rate (% change in revenue vs prior year)."""
    growth = quote.get("fundamental", {}).get("revenueGrowth", None)
    return float(growth) if growth is not None else float("nan")


def compute_market_cap(quote: dict[str, Any]) -> float:
    """Market capitalization."""
    mc = quote.get("fundamental", {}).get("marketCap", 0)
    if mc:
        return float(mc)
    price = quote.get("quote", {}).get("lastPrice", 0)
    shares = quote.get("fundamental", {}).get("sharesOutstanding", 1)
    return price * shares if price and shares else float("nan")


def compute_all_baseline_metrics(quote: dict[str, Any]) -> dict[str, float]:
    """Compute all baseline fundamental metrics from raw Schwab quote data."""
    quote_obj = quote.get("quote", {}) if isinstance(quote, dict) else {}
    fund_obj = quote.get("fundamental", {}) if isinstance(quote, dict) else {}
    combined = {"quote": quote_obj, "fundamental": fund_obj}

    return {
        "pe_ratio": compute_pe_ratio(combined),
        "pb_ratio": compute_pb_ratio(combined),
        "ev_ebitda": compute_ev_ebitda(combined),
        "fcf_yield": compute_fcf_yield(combined),
        "market_cap": compute_market_cap(combined),
        "dividend_yield": compute_dividend_yield(combined),
        "debt_equity": compute_debt_equity(combined),
        "roe": compute_roe(combined),
        "beta": compute_beta(combined),
        "revenue_growth": compute_revenue_growth(combined),
    }


def compute_valuation_efficiency_score(metrics: dict[str, float]) -> float:
    """Valuation Efficiency Score: high FCF yield, low P/E, low EV/EBITDA.

    Higher score = more efficient valuation.
    Normalized to 0-100 scale.
    """
    components = []
    if "fcf_yield" in metrics and pd.notna(metrics["fcf_yield"]):
        # Higher FCF yield = better valuation
        components.append(np.clip(metrics["fcf_yield"] * 100, 0, 50) / 50 * 100)
    if "pe_ratio" in metrics and pd.notna(metrics["pe_ratio"]) and metrics["pe_ratio"] > 0:
        # Lower P/E = better valuation
        components.append(np.clip((50 - metrics["pe_ratio"]) / 50 * 100, 0, 100))
    if "ev_ebitda" in metrics and pd.notna(metrics["ev_ebitda"]) and metrics["ev_ebitda"] > 0:
        # Lower EV/EBITDA = better valuation
        components.append(np.clip((20 - metrics["ev_ebitda"]) / 20 * 100, 0, 100))

    if not components:
        return 0.0
    return float(np.mean(components))


def compute_momentum_quality_blend(
    price_history: list[float],
    roe: float,
    revenue_growth: float,
) -> float:
    """Momentum-Quality Blend: price trend + ROE + revenue growth.

    Higher score = stronger momentum + quality.
    Normalized to 0-100 scale.
    """
    if not price_history or len(price_history) < 2:
        return 0.0

    # Momentum: 6-month price change
    prices = np.array(price_history[-126:]) if len(price_history) >= 126 else np.array(price_history)
    if len(prices) < 2:
        return 0.0

    mom_pct = (prices[-1] / prices[0] - 1) * 100

    components = [np.clip(mom_pct / 50 * 100, 0, 100)]

    if pd.notna(roe):
        components.append(np.clip(roe / 0.20 * 100, 0, 100))  # 20% ROE = 100
    if pd.notna(revenue_growth):
        components.append(np.clip(revenue_growth / 0.30 * 100, 0, 100))  # 30% growth = 100

    return float(np.mean(components))


def compute_all_metrics(
    schwab_quote: dict[str, Any],
    price_history: list[float] | None = None,
) -> dict[str, float]:
    """Compute all metrics (baseline + composites) for a single stock.

    Args:
        schwab_quote: Raw quote dict from Schwab API.
        price_history: List of daily closing prices for momentum calc.

    Returns:
        Dict of metric_name -> value.
    """
    baseline = compute_all_baseline_metrics(schwab_quote)

    # Composite metrics
    baseline["valuation_efficiency_score"] = compute_valuation_efficiency_score(baseline)

    price_history = price_history or []
    baseline["momentum_quality_blend"] = compute_momentum_quality_blend(
        price_history,
        baseline.get("roe", 0),
        baseline.get("revenue_growth", 0),
    )

    # Overall composite (simple weighted average of key metrics)
    weights = {
        "valuation_efficiency_score": 0.4,
        "momentum_quality_blend": 0.4,
        "roe": 0.1,
        "revenue_growth": 0.1,
    }
    weighted = sum(
        np.nan_to_num(baseline.get(k, 0)) * w for k, w in weights.items()
    ) / sum(weights.values())
    baseline["composite_score"] = float(np.clip(weighted, 0, 100))

    return baseline
