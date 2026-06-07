"""Deterministic compliance guard (docs/06 §6.4).

Pure logic over a bound document context + controlled-vocabulary config. Produces a
GuardReport; `ok` is False if any finding is severity 'block'. Agents never reach here —
this is the testable arbiter that gates issuance.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from coqgen_schemas import GuardFinding, GuardReport


@dataclass
class GuardContext:
    doc_type: str                       # coq | icoa
    doc_class: str                      # flower_coq | flower_icoa | ...
    product_name: str | None
    batch_number: str | None
    packaging_batch_number: str | None
    spec_reference: str | None
    gmp_wording: str | None             # what the doc will print as the facility GMP line
    disposition: str | None             # released | rejected | on_hold | None
    lines: list[dict] = field(default_factory=list)   # each: param_name, verdict, source_document_code, source_document_date, source_institution_name
    signatories: list[dict] = field(default_factory=list)  # each: role, qualified_person(bool)
    rendered_text: str | None = None    # post-render output to scan for forbidden strings
    # config (from controlled_vocabulary)
    forbidden_strings: list[str] = field(default_factory=list)
    required_gmp_wording: str | None = None
    require_signatures: int = 2


def build_guard_report(ctx: GuardContext) -> GuardReport:
    f: list[GuardFinding] = []

    # 1. completeness of mandatory release fields
    for name, val in [
        ("product_name", ctx.product_name),
        ("batch_number", ctx.batch_number),
        ("spec_reference", ctx.spec_reference),
        ("gmp_wording", ctx.gmp_wording),
    ]:
        if not val:
            f.append(GuardFinding(code="missing_field", severity="block",
                                  message=f"mandatory field missing: {name}"))
    if ctx.doc_type == "coq" and not ctx.packaging_batch_number:
        f.append(GuardFinding(code="missing_field", severity="block",
                              message="CoQ requires a packaging batch number"))
    if not ctx.lines:
        f.append(GuardFinding(code="missing_field", severity="block",
                              message="no parameter lines to certify"))

    # 2. gaps — untested/pending mandatory parameters
    gaps = [ln["param_name"] for ln in ctx.lines if ln.get("verdict") in ("not_tested", "pending")]
    if gaps:
        f.append(GuardFinding(code="spec_gap", severity="block",
                              message=f"{len(gaps)} parameter(s) not tested/pending",
                              detail=", ".join(gaps)))

    # 3. source mapping — every line must trace to a source certificate
    unmapped = [ln["param_name"] for ln in ctx.lines
                if not (ln.get("source_document_code") and ln.get("source_document_date")
                        and ln.get("source_institution_name"))]
    if unmapped:
        f.append(GuardFinding(code="source_mapping", severity="block",
                              message=f"{len(unmapped)} line(s) lack source mapping",
                              detail=", ".join(unmapped)))

    # 4. open OOS — a failing line blocks issuance (deviation per QASOP 010)
    oos = [ln["param_name"] for ln in ctx.lines if ln.get("verdict") == "fail"]
    if oos:
        f.append(GuardFinding(code="open_oos", severity="block",
                              message=f"open OOS on {len(oos)} parameter(s) — issuance blocked",
                              detail=", ".join(oos)))

    # 5. forbidden strings (e.g. "EU GMP" on flower docs) in bound data + rendered output
    haystack = " ".join(filter(None, [ctx.gmp_wording, ctx.rendered_text]))
    for term in ctx.forbidden_strings:
        if term and term.lower() in haystack.lower():
            f.append(GuardFinding(code="forbidden_string", severity="block",
                                  message=f'forbidden string on {ctx.doc_class}: "{term}"',
                                  detail="audited owner override required"))

    # 6. GMP wording matches the configured value
    if ctx.required_gmp_wording and ctx.gmp_wording and \
            ctx.required_gmp_wording.lower() not in ctx.gmp_wording.lower():
        f.append(GuardFinding(code="wording", severity="warn",
                              message=f'GMP wording is not the configured "{ctx.required_gmp_wording}"'))

    # 7. signatory rule — exactly N, no Qualified Person
    if len(ctx.signatories) != ctx.require_signatures:
        f.append(GuardFinding(code="signatory", severity="block",
                              message=f"expected {ctx.require_signatures} signatories, got {len(ctx.signatories)}"))
    if any(s.get("qualified_person") for s in ctx.signatories):
        f.append(GuardFinding(code="signatory", severity="block",
                              message="Qualified Person must not be a signatory on the manufacturer CoQ"))

    return GuardReport(ok=not any(x.severity == "block" for x in f), findings=f)
