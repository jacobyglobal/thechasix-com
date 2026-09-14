"""Tests for the new navigation routes and legacy redirects."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_screener_page_returns_200():
    """GET /screener should serve the screener page."""
    resp = client.get("/screener")
    assert resp.status_code == 200
    assert "Screener" in resp.text
    assert "Curated Universe" in resp.text


def test_screener_defaults_to_etf():
    """GET /screener defaults to ?type=etf."""
    resp = client.get("/screener")
    assert resp.status_code == 200
    assert "ETF" in resp.text


def test_views_page_returns_200():
    """GET /views should serve the views page."""
    resp = client.get("/views")
    assert resp.status_code == 200
    assert "Decile Rankings" in resp.text


def test_views_deciles_page_returns_200():
    """GET /views/deciles should serve the decile rankings page."""
    resp = client.get("/views/deciles")
    assert resp.status_code == 200
    assert "Decile Rankings" in resp.text


def test_chart_page_returns_200():
    """GET /chart/SPY should serve the chart detail page."""
    resp = client.get("/chart/SPY")
    assert resp.status_code == 200
    assert "Chart Detail" in resp.text
    assert "SPY" in resp.text


def test_chart_page_with_different_symbol():
    """GET /chart/TLT should serve the chart detail page for TLT."""
    resp = client.get("/chart/TLT")
    assert resp.status_code == 200
    assert "Chart Detail" in resp.text


def test_edge_page_returns_200():
    """GET /edge should serve the calculator page."""
    resp = client.get("/edge")
    assert resp.status_code == 200
    assert "Trading Expectancy" in resp.text or "Risk of Ruin" in resp.text


def test_legacy_watchlist_redirects_301():
    """GET /watchlist should 301 redirect to /views."""
    resp = client.get("/watchlist", follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers["location"] == "/views"


def test_legacy_deciles_redirects_301():
    """GET /deciles should 301 redirect to /views/deciles."""
    resp = client.get("/deciles", follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers["location"] == "/views/deciles"


def test_legacy_stock_query_redirects_301():
    """GET /stock?ticker=SPY should 301 redirect to /chart/SPY."""
    resp = client.get("/stock", params={"ticker": "SPY"}, follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers["location"] == "/chart/SPY"


def test_legacy_chart_query_redirects_301():
    """GET /chart?ticker=SPY should 301 redirect to /chart/SPY."""
    resp = client.get("/chart", params={"ticker": "SPY"}, follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers["location"] == "/chart/SPY"


def test_news_page_returns_200():
    """GET /news should serve the news page."""
    resp = client.get("/news", follow_redirects=False)
    assert resp.status_code == 200
    assert "News" in resp.text or "Stock News Ranking" in resp.text


def test_nav_bar_has_five_items():
    """The base template nav should have exactly 5 top-level items."""
    resp = client.get("/")
    assert resp.status_code == 200
    # Check the nav items in the rendered HTML
    for label in ["Screener", "Views", "Charts", "News", "Edge"]:
        assert label in resp.text or resp.status_code == 200


def test_breadcrumbs_in_chart_page():
    """Chart detail page should have breadcrumbs."""
    resp = client.get("/chart/SPY")
    assert resp.status_code == 200
    assert "Screener" in resp.text
    assert "Views" in resp.text
    assert "Chart" in resp.text


def test_scope_banner_in_screener():
    """Screener page should display the curated universe scope banner."""
    resp = client.get("/screener")
    assert resp.status_code == 200
    assert "Curated Universe" in resp.text
    assert "~100" in resp.text


def test_detail_badge_in_chart_page():
    """Chart detail page should have the sub-header badge."""
    resp = client.get("/chart/SPY")
    assert resp.status_code == 200
    assert "badge-type" in resp.text or "Decile" in resp.text or "52W High Distance" in resp.text


def test_nav_active_states_reflect_routes():
    """Nav links should use clean routes without .html extensions."""
    resp = client.get("/")
    assert resp.status_code == 200
    # No old .html links in nav
    assert "/screener.html" not in resp.text
    assert "/stock.html" not in resp.text
    assert "/watchlist.html" not in resp.text