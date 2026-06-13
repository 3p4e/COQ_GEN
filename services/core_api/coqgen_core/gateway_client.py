"""Client to the Letta agent gateway on KVM4 — the ONLY path to the agents.

Phase 0: thin httpx wrapper with health + a generic agent-invoke that enforces the
SUITABLE-agent allow-list locally before any call leaves the workstation. The gateway
on KVM4 enforces the same allow-list authoritatively (defense in depth).
"""
from __future__ import annotations

import httpx

from .config import get_settings

# Suitable agents only (docs/05 §5.1a). Unrelated KVM4 agents are intentionally absent.
SUITABLE_AGENTS: set[str] = {
    "coa-ingestion",
    "parameter-extraction",
    "coq-assembly",
    "compliance",
    "specification-advisor",
    "report-generation",
    "search-assistant",
    "ecoa-qc",
    "ocr-escalation",
    "variation-f",
    # apps/planner agents (PR-B/PR-C): weekly reporting + executive analytics.
    "planner-orchestrator",
    "weekly-report",
    "next-week-plan",
    "executive-analytics",
    "task-rewrite",
}


class GatewayError(RuntimeError):
    pass


class GatewayClient:
    def __init__(self) -> None:
        s = get_settings()
        self._base = s.gateway_url.rstrip("/")
        self._token = s.gateway_token

    @property
    def configured(self) -> bool:
        return bool(self._base)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"} if self._token else {}

    async def health(self) -> dict:
        if not self.configured:
            return {"configured": False, "agents": sorted(SUITABLE_AGENTS)}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{self._base}/health", headers=self._headers())
            r.raise_for_status()
            return {"configured": True, **r.json()}

    async def invoke(self, agent: str, path: str, payload: dict) -> dict:
        if agent not in SUITABLE_AGENTS:
            raise GatewayError(f"agent '{agent}' is not in the suitable-agent allow-list")
        if not self.configured:
            raise GatewayError("gateway not configured (COQGEN_GATEWAY_URL unset)")
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(f"{self._base}/{path.lstrip('/')}", json=payload, headers=self._headers())
            r.raise_for_status()
            return r.json()
