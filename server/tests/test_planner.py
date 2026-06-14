"""Planner API: routing, JWT protection, OpenAPI contract, AI graceful degradation.

These run without a database (the bearer guard rejects before any DB access).
"""
import asyncio

import pytest
from fastapi.testclient import TestClient

from planner_api.main import app

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


def test_health_is_open():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["service"] == "planner-api"


@pytest.mark.parametrize("path", PROTECTED)
def test_requires_jwt(path: str):
    assert client.get(path).status_code == 401


def test_rejects_garbage_token():
    assert client.get("/planner/tasks", headers={"Authorization": "Bearer nope"}).status_code == 401


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
    from planner_api.routers.reports import _ai

    assert asyncio.run(_ai("weekly-report", {"week_start": "2026-06-08"})) is None
