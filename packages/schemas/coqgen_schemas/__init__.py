"""Shared Pydantic v2 contracts used by core_api (and codegen'd to TypeScript for the UI).

Keep these the single definition of the cross-boundary shapes. Generate TS types with:
    datamodel-codegen / openapi typescript from the core_api OpenAPI, or
    pydantic2ts against this module.
"""
from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str = "ok"
    service: str
    version: str


class DbHealth(BaseModel):
    connected: bool
    server_version: str | None = None
    tables: int | None = None
    error: str | None = None


class SpecGrade(BaseModel):
    grade: str
    designation: str | None = None
    product_code: str | None = None
    thc_low: float | None = None
    thc_high: float | None = None
    cbd_max: float | None = None


class SpecParameter(BaseModel):
    display_order: int | None = None
    param_name: str
    method: str | None = None
    operator: str | None = None
    limit_low: float | None = None
    limit_high: float | None = None
    limit_text: str | None = None
    unit: str | None = None


class ProductSpec(BaseModel):
    spec_code: str
    version: str
    category: str = Field(description="IMG | IPM | FP | IMB")
    title: str
    dominance: str | None = Field(default=None, description="THC | CBD (strain-agnostic)")
    status: str = "active"
    effective_from: date | None = None
    parameters: list[SpecParameter] = []
    grades: list[SpecGrade] = []


class IngestAccepted(BaseModel):
    """Phase 0 stub response for an accepted ingest request."""
    received: int
    document_codes: list[str] = []
    note: str = "Phase 0 stub: OCR/parse/embed + agent extraction land in Phase 1-2."


# ---------------------------------------------------------------------------
# Planned-endpoint contracts (Phase 1.5 view bindings, docs/11 §7).
# These are the typed shapes the UI (Design agent) binds to. Backend endpoints
# return them as real reads (empty lists until data exists). Verdict/status
# string unions are documented inline rather than enums to keep TS codegen flat.
# ---------------------------------------------------------------------------

class DocumentRef(BaseModel):
    """A source certificate (iCoA/eCoA) in feeds and ingestion lists."""
    document_code: str
    cert_type: str = "eCoA"            # iCoA | eCoA
    doc_type: str = "cannabis_coa"     # cannabis_coa | water_quality | other
    institution_name: str | None = None
    lab_code: str | None = None
    batch_number: str | None = None
    issue_date: date | None = None
    register_status: str | None = None  # pending_review | accepted | rejected | voided
    extraction_confidence: float | None = None


class BatchSummary(BaseModel):
    production_batch_number: str
    packaging_batch_number: str | None = None
    product_name: str
    dominance: str | None = None        # THC | CBD (classification, not strain)
    grade: str | None = None            # I..V
    grade_designation: str | None = None
    spec_reference: str | None = None
    status: str
    params_total: int = 0
    params_conforming: int = 0
    params_pending: int = 0


class LineageRef(BaseModel):
    cultivation_batch_number: str | None = None
    production_batch_number: str
    packaging_batch_numbers: list[str] = []


class Batch(BaseModel):
    production_batch_number: str
    product_name: str
    strain: str | None = None           # DESCRIPTIVE only — never a spec selector
    dominance: str | None = None
    grade: str | None = None
    grade_designation: str | None = None
    spec_code: str | None = None
    spec_version: str | None = None
    spec_reference: str | None = None
    status: str
    production_date: date | None = None
    quantity_kg: float | None = None
    lineage: LineageRef


class MasterParameterLine(BaseModel):
    """Single source-of-truth parameter row for the Batch Record + COQ lines."""
    canonical_key: str | None = None
    param_name: str
    method: str | None = None
    acceptance_text: str | None = None
    result_display: str | None = None
    unit: str | None = None
    verdict: str = "pending"            # pass | fail | pending | not_tested
    source_institution_name: str | None = None
    source_lab_code: str | None = None
    source_document_code: str | None = None   # maps back to the source eCoA/iCoA
    source_document_date: date | None = None
    confidence: float | None = None
    status: str = "draft"              # draft | confirmed | superseded


class RegisterEntry(BaseModel):
    """Certificate Issuance Register row (iCoA/eCoA/CoQ) — QCSOP 012 v3."""
    cert_type: str                      # iCoA | eCoA | CoQ
    certificate_number: str
    seq_no: int | None = None
    year: int | None = None
    batch_no: str | None = None
    product_name: str | None = None
    spec_ref: str | None = None
    issue_date: date | None = None
    prepared_by: str | None = None
    reviewed_by: str | None = None
    status: str
    oos_ref: str | None = None
    archive_ref: str | None = None


class OOSItem(BaseModel):
    """An out-of-specification result blocking CoQ issuance (OOS/NCR view)."""
    batch_no: str | None = None
    canonical_key: str | None = None
    param_name: str
    result_display: str | None = None
    acceptance_text: str | None = None
    source_document_code: str | None = None
    status: str = "open"              # open | under_investigation | closed


class DocumentTemplate(BaseModel):
    """A versioned template for a document the app GENERATES (iCoA/CoQ/CoA/Spec)."""
    doc_type: str                       # icoa | coq | coa | spec
    name: str
    version: str
    doc_class: str = "flower_coq"
    render_engine: str = "weasyprint"   # weasyprint | playwright
    status: str = "active"             # active | superseded | draft
    is_active: bool = True


class TemplateUpload(BaseModel):
    """Upload a new template version; supersedes the prior active for its doc_type."""
    doc_type: str                       # icoa | coq | coa | spec
    name: str
    version: str
    html: str
    doc_class: str = "flower_coq"
    render_engine: str = "weasyprint"


class LabInstitution(BaseModel):
    lab_code: str | None = None
    name: str
    address: str | None = None
    credentials: str | None = None
    default_language: str | None = None


class ParameterDictionaryEntry(BaseModel):
    canonical_key: str
    display_name: str
    category: str
    canonical_unit: str | None = None
    default_method_family: str | None = None
    default_source: str | None = None   # internal (iCoA) | external (eCoA) | not_performed


class DashboardSummary(BaseModel):
    batches_in_testing: int = 0
    ecoa_pending_review: int = 0
    coqs_issued_this_year: int = 0
    open_oos: int = 0
    recent_documents: list[DocumentRef] = []
    recent_batches: list[BatchSummary] = []
