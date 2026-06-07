"""Reference catalog endpoints — Laboratories and the Parameter Dictionary."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import LabInstitution, ParameterDictionaryEntry

from ..db import get_session
from ..deps import require_session

router = APIRouter(tags=["catalog"], dependencies=[Depends(require_session)])


@router.get("/labs", response_model=list[LabInstitution])
async def labs(session: AsyncSession = Depends(get_session)) -> list[LabInstitution]:
    rows = (
        await session.execute(
            text(
                "SELECT lab_code, name, address, credentials, default_language "
                "FROM institution ORDER BY lab_code NULLS LAST, name"
            )
        )
    ).mappings().all()
    return [LabInstitution(**r) for r in rows]


@router.get("/parameters", response_model=list[ParameterDictionaryEntry])
async def parameters(session: AsyncSession = Depends(get_session)) -> list[ParameterDictionaryEntry]:
    rows = (
        await session.execute(
            text(
                "SELECT canonical_key, display_name, category, canonical_unit, default_method_family "
                "FROM parameter_dictionary ORDER BY category, display_name"
            )
        )
    ).mappings().all()
    return [ParameterDictionaryEntry(**r) for r in rows]
