"""Dashboard summary — KPIs + recent feeds (Phase 1.5 read)."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import BatchSummary, DashboardSummary, DocumentRef

from ..db import get_session
from ..deps import require_session
from .batches import _SUMMARY_SQL

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_session)])


@router.get("/summary", response_model=DashboardSummary)
async def summary(session: AsyncSession = Depends(get_session)) -> DashboardSummary:
    async def scalar(sql: str, **params) -> int:
        return int((await session.execute(text(sql), params)).scalar_one() or 0)

    batches_in_testing = await scalar(
        "SELECT count(*) FROM production_batch WHERE status = 'testing'"
    )
    ecoa_pending = await scalar(
        "SELECT count(*) FROM ecoa_document WHERE register_status = 'pending_review'"
    )
    coqs_ytd = await scalar(
        "SELECT count(*) FROM coq WHERE status = 'issued' "
        "AND EXTRACT(YEAR FROM issued_at) = :y",
        y=date.today().year,
    )
    open_oos = await scalar(
        "SELECT count(*) FROM master_parameter WHERE verdict = 'fail' AND status <> 'superseded'"
    )

    docs = (
        await session.execute(
            text(
                "SELECT d.document_code, d.cert_type, d.doc_type, d.batch_number, d.issue_date, "
                "d.register_status, d.extraction_confidence, i.name AS institution_name, "
                "i.lab_code FROM ecoa_document d LEFT JOIN institution i ON i.id = d.institution_id "
                "ORDER BY d.created_at DESC LIMIT 8"
            )
        )
    ).mappings().all()

    recent_batches = (
        await session.execute(text(_SUMMARY_SQL + " LIMIT 8"))
    ).mappings().all()

    return DashboardSummary(
        batches_in_testing=batches_in_testing,
        ecoa_pending_review=ecoa_pending,
        coqs_issued_this_year=coqs_ytd,
        open_oos=open_oos,
        recent_documents=[DocumentRef(**d) for d in docs],
        recent_batches=[BatchSummary(**b) for b in recent_batches],
    )
