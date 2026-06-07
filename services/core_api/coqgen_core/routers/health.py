"""Health endpoints (unauthenticated)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import DbHealth, Health

from .. import __version__
from ..db import get_session
from ..gateway_client import GatewayClient

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Health)
async def health() -> Health:
    return Health(service="coqgen-core", version=__version__)


@router.get("/healthz/db", response_model=DbHealth)
async def health_db(session: AsyncSession = Depends(get_session)) -> DbHealth:
    try:
        ver = (await session.execute(text("SHOW server_version"))).scalar_one()
        n = (
            await session.execute(
                text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
            )
        ).scalar_one()
        return DbHealth(connected=True, server_version=str(ver), tables=int(n))
    except Exception as exc:  # noqa: BLE001
        return DbHealth(connected=False, error=str(exc))


@router.get("/healthz/gateway")
async def health_gateway() -> dict:
    return await GatewayClient().health()
