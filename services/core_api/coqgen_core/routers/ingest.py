"""Ingest endpoint — Phase 0 stub.

Accepts a list of source-file descriptors and acknowledges them. The real pipeline
(SHA-256 dedup -> OCR/parse/embed -> agent extraction -> staging) is implemented in
Phase 1-2 (docs/04, docs/07).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from coqgen_schemas import IngestAccepted

from ..deps import require_session

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_session)])


class IngestRequest(BaseModel):
    batch_hint: str | None = None
    filenames: list[str] = []


@router.post("", response_model=IngestAccepted)
async def ingest(req: IngestRequest) -> IngestAccepted:
    return IngestAccepted(received=len(req.filenames), document_codes=[])
