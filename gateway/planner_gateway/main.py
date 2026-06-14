"""Planner Letta Gateway — the single path from planner_api to the Letta agent fleet.

Maps logical planner-agent names to Letta agent IDs, forwards a user message to
POST {LETTA_BASE_URL}/v1/agents/{id}/messages, and returns the agent's assistant JSON.
Enforces the agent allow-list (defense in depth) and persists submitted weekly reports
into the executive agent's memory so its analysis is cross-week stateful.
"""
from __future__ import annotations

import json

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import __version__
from .config import agent_map, get_settings

app = FastAPI(title="Planner Letta Gateway", version=__version__)


def _assistant_json(letta_response: dict) -> dict:
    """Return the agent's last assistant message parsed as JSON ({"text": raw} on miss)."""
    content = None
    for m in letta_response.get("messages", []):
        if m.get("message_type") == "assistant_message" and m.get("content"):
            content = m["content"]
    if not content:
        return {}
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return {"text": content}


async def _letta_message(agent_id: str, content: str) -> dict:
    s = get_settings()
    headers = {"Authorization": f"Bearer {s.letta_token}"} if s.letta_token else {}
    async with httpx.AsyncClient(timeout=s.request_timeout) as c:
        r = await c.post(
            f"{s.letta_base_url.rstrip('/')}/v1/agents/{agent_id}/messages",
            json={"messages": [{"role": "user", "content": content}]},
            headers=headers,
        )
        r.raise_for_status()
        return r.json()


@app.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "letta_configured": bool(s.letta_base_url),
        "agents": sorted(agent_map().keys()),
    }


class InvokeRequest(BaseModel):
    message: str = ""
    context: dict | None = None


@app.post("/agents/{name}/invoke")
async def invoke(name: str, req: InvokeRequest) -> dict:
    amap = agent_map()
    if name not in amap:
        raise HTTPException(status_code=404, detail=f"agent '{name}' not in allow-list")
    s = get_settings()
    if not s.letta_base_url:
        raise HTTPException(status_code=503, detail="LETTA_BASE_URL not configured")
    content = req.message or ""
    if req.context:
        content = (content + "\n\n" + json.dumps(req.context, default=str)).strip()
    return _assistant_json(await _letta_message(amap[name], content))


class ExecReport(BaseModel):
    week_start: str
    user: str
    completed: str | None = None
    progress: str | None = None
    next_plan: str | None = None


@app.post("/memory/exec/report")
async def exec_report(rep: ExecReport) -> dict:
    """Persist a submitted weekly report into the executive agent's durable memory."""
    s = get_settings()
    if not s.letta_base_url:
        raise HTTPException(status_code=503, detail="LETTA_BASE_URL not configured")
    content = (
        "RECORD this submitted weekly report into your durable memory of the organization. "
        "Update the 'organization' memory block with any durable trend or recurring risk, then "
        "reply with {\"ok\":true}.\n\n" + json.dumps(rep.model_dump(), default=str)
    )
    await _letta_message(s.agent_executive_analytics, content)
    return {"recorded": True}


def run() -> None:
    import uvicorn

    s = get_settings()
    uvicorn.run(app, host=s.bind_host, port=s.bind_port)


if __name__ == "__main__":
    run()
