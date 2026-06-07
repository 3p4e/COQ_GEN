"""Shared dependencies — session-token auth for the localhost sidecar.

The Tauri shell issues a per-session token and sends it as X-COQGEN-Token on every
call. Health endpoints are exempt so the shell can probe readiness before auth.
"""
from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_session(x_coqgen_token: str | None = Header(default=None)) -> None:
    expected = get_settings().session_token
    if not expected:  # empty token disables the check (explicit opt-out)
        return
    if x_coqgen_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or missing session token"
        )
