"""Tests for the /api/health service-status endpoint."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health_returns_200():
    resp = client.get("/api/health")
    assert resp.status_code == 200


def test_health_shape():
    resp = client.get("/api/health")
    body = resp.json()
    for key in ("status", "service", "version", "uptime_seconds", "database"):
        assert key in body
    assert body["status"] == "ok"
    assert body["service"] == "thechasix-api"
    assert isinstance(body["uptime_seconds"], int)
    assert body["database"] in ("up", "down")