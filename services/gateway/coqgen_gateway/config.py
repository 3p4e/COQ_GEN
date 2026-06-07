from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    letta_base_url: str = ""           # LETTA_BASE_URL
    letta_token: str = ""              # LETTA_TOKEN
    gateway_bind_host: str = "0.0.0.0"
    gateway_bind_port: int = 8800


def get_settings() -> Settings:
    return Settings()
