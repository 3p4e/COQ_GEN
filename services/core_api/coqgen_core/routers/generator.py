"""Document generator/issue engine endpoints (docs/06).

POST /coq/preview, /coq/issue, /icoa/preview, /icoa/issue.
  preview = bind batch data -> render (active template or fallback) -> compliance guard. No writes.
  issue   = guard must pass (block findings need override_reason) -> transactional numbering
            -> register write -> persist rendered artifact. Atomic.

The render context implements the Variation F token contract (templates/coq/README.md):
coq/spec/product/batch/lineage/labs[]/parameter_groups[]/conformance/sources[]/signatories[]/
manufacturer. PDF/A export + dual e-signature are later steps (docs/06 §6.8-6.9).
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
_CAT_LABEL = {
    "identity": "Identification", "cannabinoids": "Cannabinoids / Assay", "physical": "Physical Tests",
    "microbiology": "Microbiology", "mycotoxins": "Mycotoxins", "heavy_metals": "Heavy Metals",
    "pesticides": "Pesticides", "water_activity": "Water Activity", "residual_solvents": "Residual Solvents",
}
_CAT_ORDER = list(_CAT_LABEL)
_STATUS_LABEL = {"pass": "Pass", "fail": "OOS", "pending": "Pending", "not_tested": "Not Tested"}


def _result_display(r) -> str | None:
    val = r["result_text"] or (str(r["result_value"]) if r["result_value"] is not None else None)
    return " ".join(p for p in [r["result_qualifier"], val, r["unit"]] if p) or None


async def _config(session: AsyncSession, doc_class: str) -> dict:
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
          "qualified_person": bool((s["payload"] or {}).get("qualified_person")),
          "slot": (s["payload"] or {}).get("slot", 0)} for s in sigs),
        key=lambda x: x["slot"],
    )
    return {
        "forbidden_strings": [s["term"] for s in forbidden],
        "required_gmp_wording": wording[0]["term"] if wording else None,
        "gmp_wording": wording[0]["term"] if wording else None,
        "signatories": signatories,
    }


async def _appcfg(session: AsyncSession, key: str, default: dict) -> dict:
    row = (await session.execute(
        text("SELECT value FROM app_config WHERE key=:k"), {"k": key})).scalar_one_or_none()
    return row if isinstance(row, dict) else default


async def _gather(session: AsyncSession, doc_type: str, req) -> dict:
    cert_type, doc_class, title, internal_only = _DOC[doc_type]
    cols = ("pb.id AS prod_id, pb.batch_number AS production_batch_number, pb.product_name, "
            "pb.dominance, pb.grade, pb.grade_designation, pb.production_date, pb.quantity_kg, "
            "cb.batch_number AS cultivation_batch_number, cb.strain, "
            "ps.id AS spec_id, ps.spec_code, ps.version AS spec_version, ps.title AS spec_title")
    if doc_type == "coq":
        if not req.packaging_batch_number:
            raise HTTPException(422, "packaging_batch_number is required for CoQ")
        head = (await session.execute(text(
            f"SELECT {cols}, pk.id AS pkg_id, pk.packaging_batch_number, pk.pack_format, "
            "pk.quantity_units, pk.packaging_date "
            "FROM packaging_batch pk JOIN production_batch pb ON pb.id=pk.production_batch_id "
            "LEFT JOIN cultivation_batch cb ON cb.id=pb.cultivation_batch_id "
            "LEFT JOIN product_spec ps ON ps.id=pb.product_spec_id "
            "WHERE pk.packaging_batch_number=:p"), {"p": req.packaging_batch_number})).mappings().first()
    else:
        if not req.production_batch_number:
            raise HTTPException(422, "production_batch_number is required for iCoA")
        head = (await session.execute(text(
            f"SELECT {cols}, NULL AS pkg_id, NULL AS packaging_batch_number, NULL AS pack_format, "
            "NULL AS quantity_units, NULL AS packaging_date "
            "FROM production_batch pb LEFT JOIN cultivation_batch cb ON cb.id=pb.cultivation_batch_id "
            "LEFT JOIN product_spec ps ON ps.id=pb.product_spec_id "
            "WHERE pb.batch_number=:p"), {"p": req.production_batch_number})).mappings().first()
    if head is None:
        raise HTTPException(404, "batch not found")

    filt = ("AND mp.canonical_key IN (SELECT canonical_key FROM parameter_dictionary "
            "WHERE default_source='internal')") if internal_only else ""
    rows = (await session.execute(text(
        "SELECT mp.canonical_key, sp.param_name, sp.method, sp.limit_text AS acceptance_text, "
        "mp.result_value, mp.result_text, mp.result_qualifier, mp.result_unit AS unit, mp.verdict, "
        "mp.source_document_code, mp.source_document_date, pd.category, "
        "i.name AS lab_name, i.lab_code, i.address AS lab_address, i.credentials AS lab_credentials "
        "FROM master_parameter mp JOIN production_batch pb ON pb.id=mp.production_batch_id "
        "LEFT JOIN spec_parameter sp ON sp.id=mp.spec_parameter_id "
        "LEFT JOIN institution i ON i.id=mp.source_institution_id "
        "LEFT JOIN parameter_dictionary pd ON pd.canonical_key=mp.canonical_key "
        f"WHERE pb.id=:pid AND mp.status='confirmed' {filt} "
        "ORDER BY pd.category NULLS LAST, sp.display_order NULLS LAST, sp.param_name"),
        {"pid": head["prod_id"]})).mappings().all()

    spec_ref = f"{head['spec_code']} {head['spec_version']}" if head["spec_code"] else None
    product_code = None
    if head["spec_id"] and head["grade"]:
        product_code = (await session.execute(text(
            "SELECT product_code FROM spec_grade WHERE product_spec_id=:s AND grade=:g"),
            {"s": head["spec_id"], "g": head["grade"]})).scalar_one_or_none()

    # flat lines (for the guard) + grouped params + labs + sources
    flat, by_cat, labs, sources, seen_lab, seen_src = [], {}, [], [], {}, {}
    for r in rows:
        disp = _result_display(r)
        flat.append({"param_name": r["param_name"] or (r["canonical_key"] or "—"),
                     "verdict": r["verdict"], "source_document_code": r["source_document_code"],
                     "source_document_date": str(r["source_document_date"]) if r["source_document_date"] else None,
                     "source_institution_name": r["lab_name"]})
        cat = r["category"] or "other"
        by_cat.setdefault(cat, []).append({
            "name": r["param_name"] or (r["canonical_key"] or "—"), "method": r["method"],
            "acceptance": r["acceptance_text"], "result": disp, "verdict": r["verdict"],
            "status_label": _STATUS_LABEL.get(r["verdict"], r["verdict"]),
            "source_code": r["source_document_code"]})
        if r["lab_code"] and r["lab_code"] not in seen_lab:
            seen_lab[r["lab_code"]] = {"tag": r["lab_code"], "name": r["lab_name"],
                                       "address": r["lab_address"], "credentials": r["lab_credentials"],
                                       "_cats": set()}
        if r["lab_code"]:
            seen_lab[r["lab_code"]]["_cats"].add(_CAT_LABEL.get(cat, cat))
        if r["source_document_code"] and r["source_document_code"] not in seen_src:
            seen_src[r["source_document_code"]] = {
                "code": r["source_document_code"], "lab": r["lab_name"],
                "received": str(r["source_document_date"]) if r["source_document_date"] else None}
    for lab in seen_lab.values():
        lab["scope"] = ", ".join(sorted(lab.pop("_cats")))
        labs.append(lab)
    sources = list(seen_src.values())
    parameter_groups = [{"label": _CAT_LABEL.get(c, c.title()), "params": by_cat[c]}
                        for c in _CAT_ORDER if c in by_cat] + \
                       [{"label": c.title(), "params": by_cat[c]} for c in by_cat if c not in _CAT_ORDER]

    cfg = await _config(session, doc_class)
    man = await _appcfg(session, "manufacturer", {})
    meta = await _appcfg(session, "coq_meta", {})
    pmeta = await _appcfg(session, "product_meta", {})

    has_fail = any(x["verdict"] == "fail" for x in flat)
    has_gap = any(x["verdict"] in ("pending", "not_tested") for x in flat)
    if not flat:
        conformance = {"statement": "No parameters available.", "detail": ""}
        disposition = None
    elif has_fail:
        oos = ", ".join(x["param_name"] for x in flat if x["verdict"] == "fail")
        conformance = {"statement": f"OUT OF SPECIFICATION against {spec_ref}.",
                       "detail": f"Out of Specification — {oos}"}
        disposition = "Rejected"
    elif has_gap:
        conformance = {"statement": "Pending — parameter set incomplete.", "detail": ""}
        disposition = None
    else:
        conformance = {"statement": f"This batch CONFORMS to specification {spec_ref}.",
                       "detail": "All tested parameters meet the acceptance criteria."}
        disposition = "Released"

    context = {
        "doc_title": title,
        "coq": {"number": None, "version": meta.get("version"), "annex": meta.get("annex"),
                "record_code": meta.get("record_code"), "sop_ref": meta.get("sop_ref"),
                "coding_wi": meta.get("coding_wi"), "notice_text": meta.get("notice_text"),
                "compilation_date": str(date.today()), "spec_reference": spec_ref,
                "disposition": disposition},
        "spec": {"reference": spec_ref},
        "product": {"title": pmeta.get("title"), "description": pmeta.get("description"),
                    "standard_line": pmeta.get("standard_line"), "code": product_code},
        "batch": {"product_name": head["product_name"], "dominance": head["dominance"],
                  "grade": head["grade"], "grade_designation": head["grade_designation"],
                  "production_batch_number": head["production_batch_number"],
                  "packaging_batch_number": head["packaging_batch_number"],
                  "packaging_no": head["packaging_batch_number"], "strain": head["strain"],
                  "size": head["pack_format"], "quantity": head["quantity_units"],
                  "packaging_date": str(head["packaging_date"]) if head["packaging_date"] else None},
        "lineage": {"cultivation": head["cultivation_batch_number"],
                    "processing": head["production_batch_number"],
                    "imb": head["production_batch_number"],
                    "packaging": head["packaging_batch_number"]},
        "labs": labs, "parameter_groups": parameter_groups, "sources": sources,
        "conformance": conformance,
        "signatories": [{"role": s["meaning"], "title": s["role"]} for s in cfg["signatories"]],
        "manufacturer": {"name": man.get("name"), "address": man.get("address"),
                         "gmp_line": man.get("gmp_line") or cfg["gmp_wording"], "motto": man.get("motto")},
        # convenience for the fallback template + guard
        "gmp_wording": man.get("gmp_line") or cfg["gmp_wording"],
        "lines": [{"param_name": p["name"], "method": p["method"], "acceptance_text": p["acceptance"],
                   "result_display": p["result"], "verdict": p["verdict"],
                   "source_document_code": p["source_code"]} for g in parameter_groups for p in g["params"]],
    }
    return {"cert_type": cert_type, "doc_class": doc_class, "head": head, "spec_ref": spec_ref,
            "context": context, "cfg": cfg, "lines": flat, "disposition": disposition}


def _guard(g: dict, rendered: str | None):
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
        coq_ref, ecoa_ref, reg_status = coq_id, None, "active"
    else:
        ecoa_ref = (await session.execute(text(
            "INSERT INTO ecoa_document(document_code,cert_type,origin,register_status,source_file_id,"
            "production_batch_id,batch_number,doc_type,status) "
            "VALUES (:num,'iCoA','internal','accepted',:src,:prod,:bn,'cannabis_coa','committed') RETURNING id"),
            {"num": number, "src": src_id, "prod": h["prod_id"], "bn": h["production_batch_number"]})).scalar_one()
        coq_ref, reg_status = None, "accepted"

    sigs = g["cfg"]["signatories"]
    reg_id = (await session.execute(text(
        "INSERT INTO register_entry(cert_type,coq_id,ecoa_document_id,entry_no,seq_no,year,"
        "certificate_number,batch_no,product_name,spec_ref,issue_date,prepared_by,reviewed_by,status) "
        "VALUES (:ct,:coq,:ecoa,:eno,:seq,:yr,:num,:bn,:pn,:spec,current_date,:prep,:rev,:st) RETURNING id"),
        {"ct": g["cert_type"], "coq": coq_ref, "ecoa": ecoa_ref, "eno": entry_no, "seq": seq, "yr": year,
         "num": number, "bn": h["production_batch_number"], "pn": h["product_name"], "spec": g["spec_ref"],
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
