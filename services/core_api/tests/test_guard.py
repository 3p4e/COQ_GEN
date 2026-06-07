"""Compliance guard unit tests (no DB) — the deterministic issuance gate (docs/06 §6.4)."""
from coqgen_core.engine.guard import GuardContext, build_guard_report

GOOD_LINE = {
    "param_name": "Total Aerobic Microbial Count", "verdict": "pass",
    "source_document_code": "UKIM-2026-114", "source_document_date": "2026-05-30",
    "source_institution_name": "UKIM",
}
SIGS = [
    {"role": "Senior QC Analyst", "qualified_person": False},
    {"role": "Head of QC", "qualified_person": False},
]


def _ctx(**over):
    base = dict(
        doc_type="coq", doc_class="flower_coq", product_name="Cannabis Flower IMB",
        batch_number="PB-2026-0011", packaging_batch_number="PK-2026-0021",
        spec_reference="QCSP-IMB-001 v.01", gmp_wording="MK GMP Certified Facility",
        disposition="Released", lines=[dict(GOOD_LINE)], signatories=[dict(s) for s in SIGS],
        rendered_text="<html>MK GMP Certified Facility</html>",
        forbidden_strings=["EU GMP"], required_gmp_wording="MK GMP Certified Facility",
    )
    base.update(over)
    return GuardContext(**base)


def test_clean_coq_passes():
    assert build_guard_report(_ctx()).ok is True


def test_forbidden_eu_gmp_blocks():
    r = build_guard_report(_ctx(gmp_wording="EU GMP Certified Facility",
                                rendered_text="<html>EU GMP Certified Facility</html>"))
    assert r.ok is False
    assert any(f.code == "forbidden_string" and f.severity == "block" for f in r.findings)


def test_open_oos_blocks():
    bad = dict(GOOD_LINE)
    bad["verdict"] = "fail"
    r = build_guard_report(_ctx(lines=[bad]))
    assert r.ok is False
    assert any(f.code == "open_oos" for f in r.findings)


def test_gap_blocks():
    pend = dict(GOOD_LINE)
    pend["verdict"] = "not_tested"
    r = build_guard_report(_ctx(lines=[pend]))
    assert any(f.code == "spec_gap" and f.severity == "block" for f in r.findings)


def test_missing_source_mapping_blocks():
    nomap = dict(GOOD_LINE)
    nomap["source_document_code"] = None
    r = build_guard_report(_ctx(lines=[nomap]))
    assert any(f.code == "source_mapping" for f in r.findings)


def test_qualified_person_signatory_blocks():
    sigs = [dict(SIGS[0]), {"role": "Qualified Person", "qualified_person": True}]
    r = build_guard_report(_ctx(signatories=sigs))
    assert r.ok is False
    assert any(f.code == "signatory" for f in r.findings)


def test_wrong_signatory_count_blocks():
    r = build_guard_report(_ctx(signatories=[dict(SIGS[0])]))
    assert any(f.code == "signatory" for f in r.findings)
