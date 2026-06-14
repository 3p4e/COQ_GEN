"""Runtime configuration (pydantic-settings). Override via PLANNER_* env vars or .env."""
from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# JWT secrets shipped as placeholders; refused outside dev so prod can't boot insecure.
_INSECURE_JWT_SECRETS = frozenset(
    {"dev-insecure-jwt-secret-change-me", "dev-insecure-change-me"}
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PLANNER_", env_file=".env", extra="ignore")

    # Database (PostgreSQL + pgvector). Async driver = psycopg3.
    database_url: str = "postgresql+psycopg://planner:planner@127.0.0.1:5432/planner_dev"

    # API bind.
    bind_host: str = "127.0.0.1"
    bind_port: int = 8765

    # CORS origins for the web app (comma-separated or JSON list via PLANNER_CORS_ORIGINS).
    cors_origins: list[str] = [
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]

    # JWT auth. Override jwt_secret in any non-dev environment.
    jwt_secret: str = "dev-insecure-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 720  # 12h working day

    # Optional Letta agent gateway (AI features degrade gracefully when unset).
    gateway_url: str = ""
    gateway_token: str = ""

    environment: str = "dev"  # dev | validation | prod

    @model_validator(mode="after")
    def _reject_insecure_jwt_secret(self) -> "Settings":
        # Fail fast: never serve a non-dev environment with a placeholder JWT secret.
        if self.environment != "dev" and self.jwt_secret in _INSECURE_JWT_SECRETS:
            raise ValueError(
                f"PLANNER_JWT_SECRET is a known insecure default in environment "
                f"'{self.environment}'. Set PLANNER_JWT_SECRET to a strong secret "
                f"(e.g. `openssl rand -hex 32`)."
            )
        return self


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
