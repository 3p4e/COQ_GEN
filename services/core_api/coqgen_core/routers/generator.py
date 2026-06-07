"""Document generator/issue engine endpoints (docs/06).

POST /coq/preview, /coq/issue, /icoa/preview, /icoa/issue.
  preview = bind batch data -> render (active template or fallback) -> compliance guard. No writes.
  issue   = guard must pass (block findings need override_reason) -> transactional numbering
            -> register write -> persist rendered artifact. Atomic.

PDF/A export + dual e-signature are later steps (docs/06 §6.8-6.9); this is the HTML issue path.
"""
from __future__ import annotations

import hashlib
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import GeneratePreviewRequest, IssueRequest, IssueResult, PreviewResult

from ..db import get_session
from ..deps import require_session
from ..engine.guard import GuardContext, build_guard_report
from ..engine.numbering import allocate, peek_next
from ..engine.rendering import render

router = APIRouter(tags=["generator"], dependencies=[Depends(require_session)])

_DOC = {  # doc_type -> (cert_type, doc_class, title, internal_only)
    "coq": ("CoQ", "flower_coq", "Certificate of Quality", False),
    "icoa": ("iCoA", "flower_icoa", "Internal Certificate of Analysis", True),
}


def _result_display(r) -> str | None:
    val = r["result_text"] or (str(r["result_value"]) if r["result_value"] is not None else None)
    return " ".join(p for p in [r["result_qualifier"], val, r["unit"]] if p) or None


async def _config(session: AsyncSession, doc_class: str) -> dict:
    """Load forbidden strings / GMP wording / signatories for a doc_class (fallback flower_coq)."""
    async def rows(domain: str, dc: str):
        return (await session.execute(
            text("SELECT term, payload FROM controlled_vocabulary "
                 "WHERE domain=:d AND doc_class=:c AND is_active"), {"d": domain, "c": dc}
        )).mappings().all()

    forbidden = await rows("forbidden_string", doc_class) or await rows("forbidden_string", "flower_coq")
    wording = await rows("gmp_wording", doc_class) or await rows("gmp_wording", "flower_coq")
    sigs = await rows("signatory", doc_class) or await rows("signatory", "flower_coq")
    signatories = sorted(
        ({"meaning": s["term"], "role": (s["payload"] or {}).get("role"),
          "qualified_person": bool((s["payload"] or {}).get("qualified_person"))} for s in sigs),
        key=lambda x: x.get("role") or "",
    )
    return {
        "forbidden_strings": [s["term"] for s in forbidden],
        "required_gmp_wording": wording[0]["term"] if wording else None,
        "gmp_wording": wording[0]["term"] if wording else None,
        "signatories": signatories,
    }


async def _gather(session: AsyncSession, doc_type: str, req) -> dict:
    cert_type, doc_class, title, internal_only = _DOC[doc_type]
    # Resolve the production batch (CoQ via packaging; iCoA via production).
    if doc_type == "coq":
        if not req.packaging_batch_number:
            raise HTTPException(422, "packaging_batch_number is required for CoQ")
        head = (await session.execute(text(
            "SELECT pb.id AS prod_id, pk.id AS pkg_id, pb.batch_number AS production_batch_number, "
            "pk.packaging_batch_number, pb.product_name, pb.dominance, pb.grade, pb.grade_designation, "
            "cb.strain, ps.spec_code, ps.version AS spec_version "
            "FROM packaging_batch pk JOIN production_batch pb ON pb.id=pk.production_batch_id "
            "LEFT JOIN cultivation_batch cb ON cb.id=pb.cultivation_batch_id "
            "LEFT JOIN product_spec ps ON ps.id=pb.product_spec_id "
            "WHERE pk.packaging_batch_number=:p"), {"p": req.packaging_batch_number})).mappings().first()
    else:
        if not req.production_batch_number:
            raise HTTPException(422, "production_batch_number is required for iCoA")
        head = (await session.execute(text(
            "SELECT pb.id AS prod_id, NULL AS pkg_id, pb.batch_number AS production_batch_number, "
            "NULL AS packaging_batch_number, pb.product_name, pb.dominance, pb.grade, pb.grade_designation, "
            "cb.strain, ps.spec_code, ps.version AS spec_version "
            "FROM production_batch pb LEFT JOIN cultivation_batch cb ON cb.id=pb.cultivation_batch_id "
            "LEFT JOIN product_spec ps ON ps.id=pb.product_spec_id "
            "WHERE pb.batch_number=:p"), {"p": req.production_batch_number})).mappings().first()
    if head is None:
        raise HTTPException(404, "batch not found")

    filt = ("AND mp.canonical_key IN (SELECT canonical_key FROM parameter_dictionary "
            "WHERE default_source='internal')") if internal_only else ""
    rows = (await session.execute(text(
        f"SELECT mp.canonical_key, sp.param_name, sp.method, sp.limit_text AS acceptance_text, "
        "mp.result_value, mp.result_text, mp.result_qualifier, mp.result_unit AS unit, mp.verdict, "
        "mp.source_document_code, mp.source_document_date, i.name AS source_institution_name "
        "FROM master_parameter mp JOIN production_batch pb ON pb.id=mp.production_batch_id "
        "LEFT JOIN spec_parameter sp ON sp.id=mp.spec_parameter_id "
        "LEFT JOIN institution i ON i.id=mp.source_institution_id "
        f"WHERE pb.id=:pid AND mp.status='confirmed' {filt} "
        "ORDER BY sp.display_order NULLS LAST, sp.param_name"), {"pid": head["prod_id"]})).mappings().all()
    lines = [{
        "param_name": r["param_name"] or (r["canonical_key"] or "—"), "method": r["method"],
        "acceptance_text": r["acceptance_text"], "result_display": _result_display(r),
        "verdict": r["verdict"], "source_document_code": r["source_document_code"],
        "source_document_date": str(r["source_document_date"]) if r["source_document_date"] else None,
        "source_institution_name": r["source_institution_name"],
    } for r in rows]

    cfg = await _config(session, doc_class)
    spec_ref = f"{head['spec_code']} {head['spec_version']}" if head["spec_code"] else None
    disposition = "Released" if lines and all(x["verdict"] == "pass" for x in lines) else None
    context = {
        "doc_title": title,
        "coq": {"number": None, "spec_reference": spec_ref, "disposition": disposition},
        "batch": {k: head[k] for k in ("product_name", "dominance", "grade", "grade_designation",
                                       "production_batch_number", "packaging_batch_number", "strain")},
        "lines": lines, "gmp_wording": cfg["gmp_wording"], "signatories": cfg["signatories"],
    }
    return {"cert_type": cert_type, "doc_class": doc_class, "head": head, "spec_ref": spec_ref,
            "context": context, "cfg": cfg, "lines": lines, "disposition": disposition}


def _guard(g: dict, rendered: str | None) -> "GuardContext":
    h, ctx = g["head"], g["context"]
    return build_guard_report(GuardContext(
        doc_type="coq" if g["cert_type"] == "CoQ" else "icoa", doc_class=g["doc_class"],
        product_name=h["product_name"], batch_number=h["production_batch_number"],
        packaging_batch_number=h["packaging_batch_number"], spec_reference=g["spec_ref"],
        gmp_wording=ctx["gmp_wording"], disposition=g["disposition"], lines=g["lines"],
        signatories=g["cfg"]["signatories"], rendered_text=rendered,
        forbidden_strings=g["cfg"]["forbidden_strings"],
        required_gmp_wording=g["cfg"]["required_gmp_wording"],
    ))


async def _active_template(session: AsyncSession, doc_type: str, template_id: str | None):
    if template_id:
        return (await session.execute(text(
            "SELECT id, html FROM document_template WHERE id=:i"), {"i": template_id})).mappings().first()
    return (await session.execute(text(
        "SELECT id, html FROM document_template WHERE doc_type=:d AND is_active"),
        {"d": doc_type})).mappings().first()


async def _preview(doc_type: str, req: GeneratePreviewRequest, session: AsyncSession) -> PreviewResult:
    g = await _gather(session, doc_type, req)
    tpl = await _active_template(session, doc_type, req.template_id)
    html = render(tpl["html"] if tpl else None, g["context"])
    report = _guard(g, html)
    proposed = await peek_next(session, g["cert_type"], date.today().year)
    return PreviewResult(doc_type=doc_type, html=html, guard=report, proposed_number=proposed)


async def _issue(doc_type: str, req: IssueRequest, session: AsyncSession) -> IssueResult:
    g = await _gather(session, doc_type, req)
    tpl = await _active_template(session, doc_type, req.template_id)
    if tpl is None:
        raise HTTPException(422, f"no active template for doc_type '{doc_type}' — upload one via POST /templates")
    report = _guard(g, render(tpl["html"], g["context"]))
    if not report.ok and not req.override_reason:
        raise HTTPException(status_code=409, detail={"error": "compliance_guard_blocked",
                                                     "guard": report.model_dump()})
    year = date.today().year
    number, seq = await allocate(session, g["cert_type"], year)
    g["context"]["coq"]["number"] = number
    html = render(tpl["html"], g["context"])
    sha = hashlib.sha256(html.encode("utf-8")).digest()
    h = g["head"]
    entry_no = int((await session.execute(
        text("SELECT coalesce(max(entry_no),0)+1 FROM register_entry"))).scalar_one())
    src_id = (await session.execute(text(
        "INSERT INTO source_file(sha256,filename,mime_type,byte_size,storage_uri,is_scanned) "
        "VALUES (:s,:f,'text/html',:n,:u,false) RETURNING id"),
        {"s": sha, "f": f"{number}.html", "n": len(html), "u": f"inline://{number}"})).scalar_one()

    if g["cert_type"] == "CoQ":
        coq_id = (await session.execute(text(
            "INSERT INTO coq(coq_number,packaging_batch_id,production_batch_id,spec_reference,"
            "template_id,disposition,status,pdf_source_file_id,pdf_sha256,issued_at) "
            "VALUES (:num,:pkg,:prod,:spec,:tpl,:disp,'issued',:src,:sha,now()) RETURNING id"),
            {"num": number, "pkg": h["pkg_id"], "prod": h["prod_id"], "spec": g["spec_ref"],
             "tpl": tpl["id"], "disp": g["disposition"], "src": src_id, "sha": sha})).scalar_one()
        subject = {"coq_id": coq_id, "ecoa_document_id": None}
        reg_status = "active"
    else:
        ecoa_id = (await session.execute(text(
            "INSERT INTO ecoa_document(document_code,cert_type,origin,register_status,source_file_id,"
            "production_batch_id,batch_number,doc_type,status) "
            "VALUES (:num,'iCoA','internal','accepted',:src,:prod,:bn,'cannabis_coa','committed') RETURNING id"),
            {"num": number, "src": src_id, "prod": h["prod_id"], "bn": h["production_batch_number"]})).scalar_one()
        subject = {"coq_id": None, "ecoa_document_id": ecoa_id}
        reg_status = "accepted"

    sigs = g["cfg"]["signatories"]
    reg_id = (await session.execute(text(
        "INSERT INTO register_entry(cert_type,coq_id,ecoa_document_id,entry_no,seq_no,year,"
        "certificate_number,batch_no,product_name,spec_ref,issue_date,prepared_by,reviewed_by,status) "
        "VALUES (:ct,:coq,:ecoa,:eno,:seq,:yr,:num,:bn,:pn,:spec,current_date,:prep,:rev,:st) RETURNING id"),
        {"ct": g["cert_type"], "coq": subject["coq_id"], "ecoa": subject["ecoa_document_id"],
         "eno": entry_no, "seq": seq, "yr": year, "num": number, "bn": h["production_batch_number"],
         "pn": h["product_name"], "spec": g["spec_ref"],
         "prep": (sigs[0]["role"] if sigs else None), "rev": (sigs[1]["role"] if len(sigs) > 1 else None),
         "st": reg_status})).scalar_one()
    await session.commit()
    return IssueResult(doc_type=doc_type, certificate_number=number, sha256=sha.hex(),
                       guard=report, register_entry_id=str(reg_id), html=html)


@router.post("/coq/preview", response_model=PreviewResult)
async def coq_preview(req: GeneratePreviewRequest, session: AsyncSession = Depends(get_session)):
    return await _preview("coq", req, session)


@router.post("/coq/issue", response_model=IssueResult)
async def coq_issue(req: IssueRequest, session: AsyncSession = Depends(get_session)):
    return await _issue("coq", req, session)


@router.post("/icoa/preview", response_model=PreviewResult)
async def icoa_preview(req: GeneratePreviewRequest, session: AsyncSession = Depends(get_session)):
    return await _preview("icoa", req, session)


@router.post("/icoa/issue", response_model=IssueResult)
async def icoa_issue(req: IssueRequest, session: AsyncSession = Depends(get_session)):
    return await _issue("icoa", req, session)
