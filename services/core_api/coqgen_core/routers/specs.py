"""Read-only product specification endpoints (proves DB connectivity end-to-end)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import ProductSpec, SpecGrade, SpecParameter

from ..db import get_session
from ..deps import require_session

router = APIRouter(prefix="/specs", tags=["specs"], dependencies=[Depends(require_session)])


@router.get("", response_model=list[ProductSpec])
async def list_specs(session: AsyncSession = Depends(get_session)) -> list[ProductSpec]:
    rows = (
        await session.execute(
            text(
                "SELECT spec_code, version, category, title, dominance, status, effective_from "
                "FROM product_spec ORDER BY spec_code, version"
            )
        )
    ).mappings().all()
    return [ProductSpec(**r) for r in rows]


@router.get("/{spec_code}/{version}", response_model=ProductSpec)
async def get_spec(
    spec_code: str, version: str, session: AsyncSession = Depends(get_session)
) -> ProductSpec:
    head = (
        await session.execute(
            text(
                "SELECT id, spec_code, version, category, title, dominance, status, effective_from "
                "FROM product_spec WHERE spec_code=:c AND version=:v"
            ),
            {"c": spec_code, "v": version},
        )
    ).mappings().first()
    if head is None:
        raise HTTPException(status_code=404, detail="spec not found")
    params = (
        await session.execute(
            text(
                "SELECT display_order, param_name, method, operator, limit_low, limit_high, "
                "limit_text, unit FROM spec_parameter WHERE product_spec_id=:id ORDER BY display_order"
            ),
            {"id": head["id"]},
        )
    ).mappings().all()
    grades = (
        await session.execute(
            text(
                "SELECT grade, designation, product_code, thc_low, thc_high, cbd_max "
                "FROM spec_grade WHERE product_spec_id=:id ORDER BY display_order"
            ),
            {"id": head["id"]},
        )
    ).mappings().all()
    data = {k: head[k] for k in head.keys() if k != "id"}
    return ProductSpec(
        **data,
        parameters=[SpecParameter(**p) for p in params],
        grades=[SpecGrade(**g) for g in grades],
    )
