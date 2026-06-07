"""Letta agent gateway (KVM4) — Phase 0 scaffold.

Enforces the suitable-agent allow-list, exposes health, and provides a generic
invoke that forwards a validated message to the mapped Letta agent. Full per-endpoint
JSON-Schema validation + retries/circuit-breaking land in Phase 2 (api/gateway_openapi.yaml).
"""
from __future__ import annotations

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import __version__
from .config import get_settings
from .routes import AGENT_ROUTE_MAP

app = FastAPI(title="COQ_GEN Agent Gateway", version=__version__)


@app.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "letta_configured": bool(s.letta_base_url),
        "agents": {name: "mapped" for name in sorted(AGENT_ROUTE_MAP)},
    }


class InvokeRequest(BaseModel):
    message: str
    context: dict | None = None


@app.post("/agents/{name}/invoke")
async def invoke(name: str, req: InvokeRequest) -> dict:
    if name not in AGENT_ROUTE_MAP:
        raise HTTPException(status_code=404, detail=f"agent '{name}' not in allow-list")
    s = get_settings()
    if not s.letta_base_url:
        raise HTTPException(status_code=501, detail="LETTA_BASE_URL not configured (scaffold)")
    agent_id = AGENT_ROUTE_MAP[name]
    headers = {"Authorization": f"Bearer {s.letta_token}"} if s.letta_token else {}
    payload = {"messages": [{"role": "user", "content": req.message}]}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{s.letta_base_url}/v1/agents/{agent_id}/messages",
                         json=payload, headers=headers)
        r.raise_for_status()
        return r.json()
