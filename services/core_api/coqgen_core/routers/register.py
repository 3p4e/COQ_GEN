"""Certificate Issuance Register + OOS/NCR read endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import OOSItem, RegisterEntry

from ..db import get_session
from ..deps import require_session

router = APIRouter(tags=["register"], dependencies=[Depends(require_session)])


@router.get("/register", response_model=list[RegisterEntry])
async def register(session: AsyncSession = Depends(get_session)) -> list[RegisterEntry]:
    rows = (
        await session.execute(
            text(
                "SELECT cert_type, certificate_number, seq_no, year, batch_no, product_name, "
                "spec_ref, issue_date, prepared_by, reviewed_by, status, oos_ref, archive_ref "
                "FROM register_entry ORDER BY year DESC, cert_type, seq_no DESC"
            )
        )
    ).mappings().all()
    return [RegisterEntry(**r) for r in rows]


@router.get("/oos", response_model=list[OOSItem])
async def oos(session: AsyncSession = Depends(get_session)) -> list[OOSItem]:
    # Derived: confirmed master-parameter rows with a failing verdict are open OOS.
    rows = (
        await session.execute(
            text(
                "SELECT pb.batch_number AS batch_no, mp.canonical_key, "
                "sp.param_name, sp.limit_text AS acceptance_text, "
                "mp.result_value, mp.result_text, mp.result_qualifier, mp.result_unit AS unit, "
                "mp.source_document_code "
                "FROM master_parameter mp "
                "JOIN production_batch pb ON pb.id = mp.production_batch_id "
                "LEFT JOIN spec_parameter sp ON sp.id = mp.spec_parameter_id "
                "WHERE mp.verdict = 'fail' AND mp.status <> 'superseded' "
                "ORDER BY pb.batch_number"
            )
        )
    ).mappings().all()
    out: list[OOSItem] = []
    for r in rows:
        val = r["result_text"] or (str(r["result_value"]) if r["result_value"] is not None else None)
        display = " ".join(p for p in [r["result_qualifier"], val, r["unit"]] if p)
        out.append(
            OOSItem(
                batch_no=r["batch_no"],
                canonical_key=r["canonical_key"],
                param_name=r["param_name"] or (r["canonical_key"] or "—"),
                result_display=display or None,
                acceptance_text=r["acceptance_text"],
                source_document_code=r["source_document_code"],
                status="open",
            )
        )
    return out
