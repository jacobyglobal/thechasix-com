"""Stock recommendation engine using content-based similarity.

Finds stocks similar to a given ticker based on normalized metric distances.
Uses scikit-learn for nearest-neighbor search, following the pattern
from existing analysis projects.
"""

import logging
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors

logger = logging.getLogger(__name__)

# Metrics used for similarity comparison (inverted for "bad" metrics)
SIMILARITY_METRICS = [
    "pe_ratio",
    "pb_ratio",
    "ev_ebitda",
    "fcf_yield",
    "dividend_yield",
    "roe",
    "revenue_growth",
    "betel",
]

# Metrics where lower is better (we negate these for similarity)
INVERTED_METRICS = {"pe_ratio", "pb_ratio", "ev_ebitda", "beta"}


def normalize_metrics_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize metric columns for similarity computation.

    Inverts 'bad' metrics (lower is better) so that higher normalized values
    always indicate better performance. Handles NaN by filling before scaling.
    """
    df = df.copy()
    for col in SIMILARITY_METRICS:
        if col in df.columns:
            if col in INVERTED_METRICS:
                df[col] = -df[col]
            df[col] = df[col].fillna(df[col].median())

    return df


def build_similarity_index(stock_metrics_df: pd.DataFrame) -> NearestNeighbors:
    """Build a NearestNeighbors index from a DataFrame of stock metrics.

    Args:
        stock_metrics_df: DataFrame with tickers as index and
            similarity metric columns as values.

    Returns:
        Fitted NearestNeighbors model.
    """
    df = normalize_metrics_df(stock_metrics_df)

    available_cols = [c for c in SIMILARITY_METRICS if c in df.columns]
    X = df[available_cols].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n_neighbors = min(21, len(df) - 1)
    n_neighbors = max(n_neighbors, 2)

    nn = NearestNeighbors(
        n_neighbors=n_neighbors,
        metric="euclidean",
        algorithm="ball_tree",
    )
    nn.fit(X_scaled)

    return nn


def find_similar_stocks(
    ticker: str,
    stock_metrics_df: pd.DataFrame,
    nn_model: NearestNeighbors,
    top_n: int = 10,
) -> list[dict[str, float]]:
    """Find stocks most similar to a given ticker.

    Args:
        ticker: The ticker symbol to find similarities for.
        stock_metrics_df: DataFrame of all stock metrics (index = tickers).
        nn_model: Fitted NearestNeighbors model from build_similarity_index.
        top_n: Number of similar stocks to return.

    Returns:
        List of dicts: [{"ticker": str, "similarity_score": float, ...metrics}]
        Sorted by similarity (most similar first), excluding the query ticker.
    """
    if ticker not in stock_metrics_df.index:
        logger.warning(f"Ticker {ticker} not found in metrics DataFrame")
        return []

    df = normalize_metrics_df(stock_metrics_df)
    available_cols = [c for c in SIMILARITY_METRICS if c in df.columns]
    X = df[available_cols].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    query_idx = list(df.index).index(ticker)
    query_vec = X_scaled[query_idx:query_idx + 1]

    distances, indices = nn_model.kneighbors(query_vec, n_neighbors=top_n + 1)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        result_ticker = stock_metrics_df.index[idx]
        if result_ticker == ticker:
            continue
        similarity = 1.0 / (1.0 + dist)  # Convert distance to similarity (0-1)
        result = {
            "ticker": result_ticker,
            "similarity_score": round(float(similarity), 4),
        }
        for col in available_cols:
            if col in INVERTED_METRICS:
                result[col] = float(stock_metrics_df.iloc[idx][col])
            else:
                result[col] = float(stock_metrics_df.iloc[idx][col])
        results.append(result)

        if len(results) >= top_n:
            break

    return results


def compute_similarity_matrix(
    stock_metrics_df: pd.DataFrame,
) -> pd.DataFrame:
    """Compute pairwise similarity matrix for a subset of stocks.

    Useful for heat map visualization.
    """
    df = normalize_metrics_df(stock_metrics_df)
    available_cols = [c for c in SIMILARITY_METRICS if c in df.columns]
    X = df[available_cols].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n = len(X_scaled)
    matrix = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            dist = np.sqrt(np.sum((X_scaled[i] - X_scaled[j]) ** 2))
            matrix[i, j] = 1.0 / (1.0 + dist)

    return pd.DataFrame(matrix, index=df.index, columns=df.index)
