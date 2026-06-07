"""Batch endpoints — list, detail, and the master-parameter (single source of truth) table.

Real reads against the schema; return empty/typed results until batches exist.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import Batch, BatchSummary, LineageRef, MasterParameterLine

from ..db import get_session
from ..deps import require_session

router = APIRouter(prefix="/batches", tags=["batches"], dependencies=[Depends(require_session)])

# One row per production batch with packaging no., spec ref, and param roll-up.
_SUMMARY_SQL = """
SELECT pb.batch_number AS production_batch_number,
       (SELECT pk.packaging_batch_number FROM packaging_batch pk
          WHERE pk.production_batch_id = pb.id ORDER BY pk.created_at LIMIT 1) AS packaging_batch_number,
       pb.product_name, pb.dominance, pb.grade, pb.grade_designation,
       CASE WHEN ps.spec_code IS NULL THEN NULL ELSE ps.spec_code || ' ' || ps.version END AS spec_reference,
       pb.status,
       count(mp.id) FILTER (WHERE mp.status = 'confirmed') AS params_total,
       count(mp.id) FILTER (WHERE mp.verdict = 'pass' AND mp.status = 'confirmed') AS params_conforming,
       count(mp.id) FILTER (WHERE mp.verdict IN ('pending', 'not_tested')) AS params_pending
FROM production_batch pb
LEFT JOIN product_spec ps ON ps.id = pb.product_spec_id
LEFT JOIN master_parameter mp ON mp.production_batch_id = pb.id
GROUP BY pb.id, ps.spec_code, ps.version
ORDER BY pb.created_at DESC
"""


@router.get("", response_model=list[BatchSummary])
async def list_batches(session: AsyncSession = Depends(get_session)) -> list[BatchSummary]:
    rows = (await session.execute(text(_SUMMARY_SQL))).mappings().all()
    return [BatchSummary(**r) for r in rows]


@router.get("/{batch_no}", response_model=Batch)
async def get_batch(batch_no: str, session: AsyncSession = Depends(get_session)) -> Batch:
    head = (
        await session.execute(
            text(
                "SELECT pb.id, pb.batch_number AS production_batch_number, pb.product_name, "
                "pb.dominance, pb.grade, pb.grade_designation, pb.status, pb.production_date, "
                "pb.quantity_kg, cb.batch_number AS cultivation_batch_number, cb.strain, "
                "ps.spec_code, ps.version AS spec_version "
                "FROM production_batch pb "
                "LEFT JOIN cultivation_batch cb ON cb.id = pb.cultivation_batch_id "
                "LEFT JOIN product_spec ps ON ps.id = pb.product_spec_id "
                "WHERE pb.batch_number = :b"
            ),
            {"b": batch_no},
        )
    ).mappings().first()
    if head is None:
        raise HTTPException(status_code=404, detail="batch not found")
    pkgs = [
        r["packaging_batch_number"]
        for r in (
            await session.execute(
                text(
                    "SELECT pk.packaging_batch_number FROM packaging_batch pk "
                    "WHERE pk.production_batch_id = :id ORDER BY pk.created_at"
                ),
                {"id": head["id"]},
            )
        ).mappings().all()
    ]
    spec_ref = f"{head['spec_code']} {head['spec_version']}" if head["spec_code"] else None
    return Batch(
        production_batch_number=head["production_batch_number"],
        product_name=head["product_name"],
        strain=head["strain"],
        dominance=head["dominance"],
        grade=head["grade"],
        grade_designation=head["grade_designation"],
        spec_code=head["spec_code"],
        spec_version=head["spec_version"],
        spec_reference=spec_ref,
        status=head["status"],
        production_date=head["production_date"],
        quantity_kg=head["quantity_kg"],
        lineage=LineageRef(
            cultivation_batch_number=head["cultivation_batch_number"],
            production_batch_number=head["production_batch_number"],
            packaging_batch_numbers=pkgs,
        ),
    )


@router.get("/{batch_no}/master-parameters", response_model=list[MasterParameterLine])
async def master_parameters(
    batch_no: str, session: AsyncSession = Depends(get_session)
) -> list[MasterParameterLine]:
    rows = (
        await session.execute(
            text(
                "SELECT mp.canonical_key, sp.param_name, sp.method, sp.limit_text AS acceptance_text, "
                "mp.result_value, mp.result_text, mp.result_qualifier, mp.result_unit AS unit, "
                "mp.verdict, mp.confidence, mp.status, mp.source_document_code, mp.source_document_date, "
                "i.name AS source_institution_name, i.lab_code AS source_lab_code "
                "FROM master_parameter mp "
                "JOIN production_batch pb ON pb.id = mp.production_batch_id "
                "LEFT JOIN spec_parameter sp ON sp.id = mp.spec_parameter_id "
                "LEFT JOIN institution i ON i.id = mp.source_institution_id "
                "WHERE pb.batch_number = :b "
                "ORDER BY sp.display_order NULLS LAST, sp.param_name"
            ),
            {"b": batch_no},
        )
    ).mappings().all()
    out: list[MasterParameterLine] = []
    for r in rows:
        val = r["result_text"] or (str(r["result_value"]) if r["result_value"] is not None else None)
        display = " ".join(p for p in [r["result_qualifier"], val, r["unit"]] if p)
        out.append(
            MasterParameterLine(
                canonical_key=r["canonical_key"],
                param_name=r["param_name"] or (r["canonical_key"] or "—"),
                method=r["method"],
                acceptance_text=r["acceptance_text"],
                result_display=display or None,
                unit=r["unit"],
                verdict=r["verdict"],
                source_institution_name=r["source_institution_name"],
                source_lab_code=r["source_lab_code"],
                source_document_code=r["source_document_code"],
                source_document_date=r["source_document_date"],
                confidence=r["confidence"],
                status=r["status"],
            )
        )
    return out
