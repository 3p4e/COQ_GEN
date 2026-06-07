"""COQ generator support endpoints — templates list (Phase 1.5 read).

Preview/issue (the compliance guard + numbering + e-sign + export) land with the
COQ engine in a later phase (docs/06); this exposes the available templates now.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import CoqTemplate

from ..db import get_session
from ..deps import require_session

router = APIRouter(prefix="/coq", tags=["coq"], dependencies=[Depends(require_session)])


@router.get("/templates", response_model=list[CoqTemplate])
async def templates(session: AsyncSession = Depends(get_session)) -> list[CoqTemplate]:
    rows = (
        await session.execute(
            text(
                "SELECT name, version, doc_class, render_engine, is_active "
                "FROM coq_template WHERE is_active ORDER BY name, version"
            )
        )
    ).mappings().all()
    return [CoqTemplate(**r) for r in rows]
