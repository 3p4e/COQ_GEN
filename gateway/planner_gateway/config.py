"""Gateway configuration (pydantic-settings). Override via GATEWAY_* env vars.

The only secrets are GATEWAY_LETTA_BASE_URL + GATEWAY_LETTA_TOKEN (the KVM4 Letta
server). The agent IDs default to the provisioned planner agents but are overridable.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GATEWAY_", env_file=".env", extra="ignore")

    bind_host: str = "0.0.0.0"   # container-internal; expose only within the Letta stack
    bind_port: int = 8800

    # Letta server (set these in the container env on KVM4).
    letta_base_url: str = ""     # e.g. http://letta:8283
    letta_token: str = ""
    request_timeout: float = 60.0

    # Logical planner-agent name -> Letta agent id (provisioned 2026-06-14).
    agent_weekly_report: str = "agent-c783d24a-9d85-4b0b-8882-e210f504504a"
    agent_next_week_plan: str = "agent-815929b3-8ffb-4671-992b-ee7d55273f24"
    agent_task_rewrite: str = "agent-e8518fbc-29a2-4585-8ba8-7cb45a936a18"
    agent_executive_analytics: str = "agent-e72faed9-38f8-4808-9dde-2fac12038f22"


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def agent_map() -> dict[str, str]:
    s = get_settings()
    return {
        "weekly-report": s.agent_weekly_report,
        "next-week-plan": s.agent_next_week_plan,
        "task-rewrite": s.agent_task_rewrite,
        "executive-analytics": s.agent_executive_analytics,
    }
