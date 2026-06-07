"""Document template management — list versions and upload new ones.

Templates are the layouts the app GENERATES documents from (iCoA, CoQ, CoA, Spec).
Uploading a new version supersedes the prior active template for that doc_type; the
active version is what future documents render with. Issued documents keep the exact
version they were rendered with (handled at issue time, not here).

NOTE: per-doc_type mandatory-token validation (docs/06 §6.7) is applied when each
document type's token contract is finalized; this endpoint stores + versions for now.
"""
from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import DocumentTemplate, TemplateUpload

from ..db import get_session
from ..deps import require_session

router = APIRouter(prefix="/templates", tags=["templates"], dependencies=[Depends(require_session)])

_DOC_TYPES = {"icoa", "coq", "coa", "spec"}
_COLS = "doc_type, name, version, doc_class, render_engine, status, is_active"


@router.get("", response_model=list[DocumentTemplate])
async def list_templates(
    include_superseded: bool = False, session: AsyncSession = Depends(get_session)
) -> list[DocumentTemplate]:
    where = "" if include_superseded else "WHERE is_active"
    rows = (
        await session.execute(
            text(f"SELECT {_COLS} FROM document_template {where} ORDER BY doc_type, name, version")
        )
    ).mappings().all()
    return [DocumentTemplate(**r) for r in rows]


@router.get("/{doc_type}", response_model=list[DocumentTemplate])
async def list_for_type(
    doc_type: str, session: AsyncSession = Depends(get_session)
) -> list[DocumentTemplate]:
    rows = (
        await session.execute(
            text(f"SELECT {_COLS} FROM document_template WHERE doc_type=:d ORDER BY version"),
            {"d": doc_type.lower()},
        )
    ).mappings().all()
    return [DocumentTemplate(**r) for r in rows]


@router.post("", response_model=DocumentTemplate, status_code=201)
async def upload_template(
    body: TemplateUpload, session: AsyncSession = Depends(get_session)
) -> DocumentTemplate:
    doc_type = body.doc_type.lower()
    if doc_type not in _DOC_TYPES:
        raise HTTPException(status_code=422, detail=f"doc_type must be one of {sorted(_DOC_TYPES)}")
    sha = hashlib.sha256(body.html.encode("utf-8")).digest()
    # Transaction: supersede the current active template for this doc_type, insert the
    # new one as active (linked to the one it supersedes).
    prev_id = (
        await session.execute(
            text("SELECT id FROM document_template WHERE doc_type=:d AND is_active FOR UPDATE"),
            {"d": doc_type},
        )
    ).scalar_one_or_none()
    if prev_id is not None:
        await session.execute(
            text("UPDATE document_template SET is_active=false, status='superseded' WHERE id=:id"),
            {"id": prev_id},
        )
    row = (
        await session.execute(
            text(
                "INSERT INTO document_template "
                "(doc_type,name,version,html,sha256,doc_class,render_engine,status,is_active,supersedes_id) "
                "VALUES (:d,:n,:v,:h,:s,:dc,:re,'active',true,:prev) "
                f"RETURNING {_COLS}"
            ),
            {
                "d": doc_type, "n": body.name, "v": body.version, "h": body.html, "s": sha,
                "dc": body.doc_class, "re": body.render_engine, "prev": prev_id,
            },
        )
    ).mappings().one()
    await session.commit()
    return DocumentTemplate(**row)
