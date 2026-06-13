"""Runtime configuration (pydantic-settings). No business constants hard-coded."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COQGEN_", env_file=".env", extra="ignore")

    # Database (centralised PostgreSQL + pgvector). Async driver = psycopg3.
    database_url: str = "postgresql+psycopg://coqgen:coqgen@127.0.0.1:5432/coqgen_dev"

    # Sidecar binds localhost ONLY; never exposed on the network.
    bind_host: str = "127.0.0.1"
    bind_port: int = 8765
    session_token: str = "dev-session-token"  # issued by the Tauri shell in real runs

    # Letta agent gateway on KVM4 (the ONLY path to the agents).
    gateway_url: str = ""
    gateway_token: str = ""

    # Planner (apps/planner) JWT auth. Override jwt_secret in any non-dev environment.
    jwt_secret: str = "dev-insecure-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 720  # 12h working day

    environment: str = "dev"  # dev | validation | prod


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
