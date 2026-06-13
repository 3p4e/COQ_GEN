"""Planner endpoints are registered and JWT-protected.

These run without a database (the bearer guard rejects before any DB access), so they
verify routing + auth + the OpenAPI contract, not query behaviour.
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from coqgen_core.main import app

client = TestClient(app)

# All require a valid JWT bearer; unauthenticated -> 401 before any DB access.
PROTECTED = [
    "/auth/me",
    "/planner/departments",
    "/planner/users",
    "/planner/tasks",
    "/planner/tasks/00000000-0000-0000-0000-000000000000",
    "/planner/telemetry?week_start=2026-06-08",
    "/planner/reports?week_start=2026-06-08",
    "/planner/exec/telemetry?week_start=2026-06-08",
]


@pytest.mark.parametrize("path", PROTECTED)
def test_requires_jwt(path: str):
    assert client.get(path).status_code == 401


def test_rejects_garbage_token():
    r = client.get("/planner/tasks", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401


def test_exec_insights_requires_jwt():
    assert client.post("/planner/exec/insights?week_start=2026-06-08").status_code == 401


def test_openapi_exposes_planner_shapes():
    schemas = app.openapi()["components"]["schemas"]
    for name in [
        "LoginRequest", "Token", "UserOut",
        "PlannerDepartment", "PlannerTask", "PlannerTaskCreate", "PlannerTaskUpdate",
        "PlannerSubtask", "PlannerProgressNote", "PlannerHandoff", "PlannerTelemetry",
        "PlannerWeeklyReport", "PlannerWeeklyReportUpdate",
        "AiDraftResult", "RewriteRequest", "RewriteResult", "RolloverResult",
        "ExecTelemetry", "ExecInsight", "ExecDeptStat", "ExecUserStat",
    ]:
        assert name in schemas


def test_ai_degrades_gracefully_when_gateway_unconfigured():
    # With no COQGEN_GATEWAY_URL the gateway is unconfigured, so _ai returns None
    # (callers turn this into available=False, never a 500). No network is touched.
    from coqgen_core.routers.planner_reports import _ai

    assert asyncio.run(_ai("weekly-report", {"week_start": "2026-06-08"})) is None
