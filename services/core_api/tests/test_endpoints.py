"""The Phase 1.5 read endpoints are registered and auth-protected.

These run without a database (auth is enforced before any DB access), so they
verify routing + the session-token guard, not query behaviour.
"""
import pytest
from fastapi.testclient import TestClient

from coqgen_core.main import app

client = TestClient(app)

PROTECTED = [
    "/dashboard/summary",
    "/batches",
    "/batches/PB-2026-0011",
    "/batches/PB-2026-0011/master-parameters",
    "/register",
    "/oos",
    "/templates",
    "/templates/coq",
    "/labs",
    "/parameters",
]


@pytest.mark.parametrize("path", PROTECTED)
def test_requires_session_token(path: str):
    assert client.get(path).status_code == 401


def test_openapi_exposes_phase15_shapes():
    schemas = app.openapi()["components"]["schemas"]
    for name in ["DashboardSummary", "BatchSummary", "MasterParameterLine",
                 "RegisterEntry", "OOSItem", "DocumentTemplate", "TemplateUpload",
                 "LabInstitution"]:
        assert name in schemas
