"""Shared Pydantic v2 contracts used by core_api (and codegen'd to TypeScript for the UI).

Keep these the single definition of the cross-boundary shapes. Generate TS types with:
    datamodel-codegen / openapi typescript from the core_api OpenAPI, or
    pydantic2ts against this module.
"""
from __future__ import annotations

from datetime import date, datetime
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
    doc_type: str                       # icoa (== internal CoA) | coq | spec
    name: str
    version: str
    doc_class: str = "flower_coq"
    render_engine: str = "weasyprint"   # weasyprint | playwright
    status: str = "active"             # active | superseded | draft
    is_active: bool = True


class TemplateUpload(BaseModel):
    """Upload a new template version; supersedes the prior active for its doc_type."""
    doc_type: str                       # icoa (== internal CoA) | coq | spec
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


# ---------------------------------------------------------------------------
# Generator / issue engine (docs/06). Preview = render + guard (no writes).
# Issue = guard pass -> transactional numbering -> register write -> persist.
# ---------------------------------------------------------------------------

class GuardFinding(BaseModel):
    code: str        # forbidden_string|missing_field|spec_gap|open_oos|wording|signatory|verdict|source_mapping
    severity: str    # block | warn
    message: str
    detail: str | None = None


class GuardReport(BaseModel):
    ok: bool         # False if any severity == "block"
    findings: list[GuardFinding] = []


class GeneratePreviewRequest(BaseModel):
    packaging_batch_number: str | None = None    # CoQ is issued at packaging level
    production_batch_number: str | None = None    # iCoA is issued at production level
    template_id: str | None = None                # default = the active template for the doc_type


class PreviewResult(BaseModel):
    doc_type: str                                 # coq | icoa
    html: str                                     # rendered HTML (preview returns rendered HTML)
    guard: GuardReport
    proposed_number: str | None = None            # advisory; authoritative number assigned at issue


class IssueRequest(BaseModel):
    packaging_batch_number: str | None = None
    production_batch_number: str | None = None
    template_id: str | None = None
    override_reason: str | None = None            # REQUIRED to issue when guard has block findings


class IssueResult(BaseModel):
    doc_type: str
    certificate_number: str                        # CoQ-PP-YYYY-NNNN / iCoA-PP-YYYY-NNNN
    sha256: str
    guard: GuardReport
    register_entry_id: str
    html: str


# ---------------------------------------------------------------------------
# Planner (apps/planner) — GrowFlow-style weekly production board.
# Auth (JWT) + departments + tasks. Roles: operator|hod|qa|qp|executive|admin.
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str                       # username or email
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    full_name: str
    role: str                           # operator|hod|qa|qp|executive|admin
    email: str | None = None
    avatar_url: str | None = None
    dept_id: str | None = None
    dept_key: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PlannerDepartment(BaseModel):
    id: str
    key: str
    name_en: str
    name_mk: str
    icon: str | None = None
    color: str | None = None
    handoff_to_id: str | None = None
    position: int = 0


class PlannerSubtask(BaseModel):
    id: str | None = None
    text: str
    done: bool = False
    position: int = 0


class PlannerProgressNote(BaseModel):
    id: str
    day: str | None = None
    note: str
    author_id: str | None = None
    author_name: str | None = None
    created_at: datetime | None = None


class PlannerHandoff(BaseModel):
    id: str
    to_department_id: str
    to_department_key: str | None = None
    status: str = "requested"           # requested|accepted|done
    requested_by: str | None = None
    created_at: datetime | None = None


class PlannerTask(BaseModel):
    id: str
    department_id: str
    department_key: str | None = None
    title: str
    owner_id: str | None = None
    owner_name: str | None = None
    status: str = "pending"             # pending|working|review|stuck|postponed|done
    priority: str = "medium"           # critical|high|medium|low
    week_start: date
    days: list[str] = []                # Mon..Sun
    room: str | None = None
    batch: str | None = None
    tags: list[str] = []
    description: str | None = None
    blocker: str | None = None
    position: int = 0
    helper_ids: list[str] = []
    subtasks: list[PlannerSubtask] = []
    notes: list[PlannerProgressNote] = []
    deps: list[str] = []                # task ids this task depends on
    handoffs: list[PlannerHandoff] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None
    completed_at: datetime | None = None


class PlannerTaskCreate(BaseModel):
    department_id: str
    title: str
    week_start: date
    owner_id: str | None = None
    status: str = "pending"
    priority: str = "medium"
    days: list[str] = []
    room: str | None = None
    batch: str | None = None
    tags: list[str] = []
    description: str | None = None
    blocker: str | None = None
    helper_ids: list[str] = []
    subtasks: list[PlannerSubtask] = []
    deps: list[str] = []


class PlannerTaskUpdate(BaseModel):
    department_id: str | None = None
    title: str | None = None
    owner_id: str | None = None
    status: str | None = None
    priority: str | None = None
    week_start: date | None = None
    days: list[str] | None = None
    room: str | None = None
    batch: str | None = None
    tags: list[str] | None = None
    description: str | None = None
    blocker: str | None = None
    position: int | None = None
    helper_ids: list[str] | None = None
    subtasks: list[PlannerSubtask] | None = None
    deps: list[str] | None = None


class PlannerNoteCreate(BaseModel):
    note: str
    day: str | None = None


class PlannerHandoffCreate(BaseModel):
    to_department_id: str


class PlannerTelemetry(BaseModel):
    week_start: date
    total: int = 0
    completion: int = 0                 # percent done
    by_status: dict[str, int] = {}      # status -> count
    busiest_day: str | None = None


# --- Weekly reports + AI (PR-B) --------------------------------------------
class PlannerWeeklyReport(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    week_start: date
    completed_summary: str | None = None
    progress_summary: str | None = None
    next_week_plan: str | None = None
    status: str = "draft"               # draft|submitted
    ai_generated: bool = False
    submitted_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PlannerWeeklyReportUpdate(BaseModel):
    completed_summary: str | None = None
    progress_summary: str | None = None
    next_week_plan: str | None = None


class AiDraftResult(BaseModel):
    """AI-drafted report sections. available=False ⇒ gateway unconfigured/unreachable
    (graceful degradation); the planner stays usable and the user writes manually."""
    available: bool = True
    completed_summary: str | None = None
    progress_summary: str | None = None
    next_week_plan: str | None = None
    note: str | None = None             # human-readable status when unavailable


class RewriteRequest(BaseModel):
    text: str
    tone: str = "concise"               # concise|formal|friendly


class RewriteResult(BaseModel):
    available: bool = True
    text: str
    note: str | None = None


class RolloverResult(BaseModel):
    created: int = 0
    target_week: date


# --- Executive analytics (PR-C) --------------------------------------------
class ExecDeptStat(BaseModel):
    dept_id: str
    dept_key: str
    name_en: str
    name_mk: str
    total: int = 0
    done: int = 0
    stuck: int = 0
    completion: int = 0                 # percent


class ExecUserStat(BaseModel):
    user_id: str
    user_name: str
    dept_key: str | None = None
    total: int = 0
    done: int = 0
    completion: int = 0


class ExecTelemetry(BaseModel):
    week_start: date
    total: int = 0
    completion: int = 0
    by_status: dict[str, int] = {}
    busiest_day: str | None = None
    headcount: int = 0                  # distinct task owners this week
    reports_submitted: int = 0
    by_department: list[ExecDeptStat] = []
    by_user: list[ExecUserStat] = []


class ExecInsight(BaseModel):
    """AI executive analysis over all users' weekly reports + telemetry.
    available=False ⇒ gateway unconfigured/unreachable (graceful degradation)."""
    available: bool = True
    summary: str | None = None
    highlights: list[str] = []
    risks: list[str] = []
    foresight: str | None = None
    sources: list[str] = []            # report refs the agent drew on
    note: str | None = None
