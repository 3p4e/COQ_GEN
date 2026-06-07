from fastapi.testclient import TestClient

from coqgen_core.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "coqgen-core"


def test_gateway_health_reports_suitable_agents():
    r = client.get("/healthz/gateway")
    assert r.status_code == 200
    body = r.json()
    # gateway not configured in unit tests -> returns the allow-list
    assert "coq-assembly" in body["agents"]
    assert "stock_trading_advisor" not in body["agents"]


def test_specs_requires_session_token():
    # no token header -> 401 (auth enforced on non-health routes)
    r = client.get("/specs")
    assert r.status_code == 401
