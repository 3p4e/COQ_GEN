"""Pydantic v2 contracts for the Planner API (cross-boundary shapes for the web app)."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class Health(BaseModel):
    status: str = "ok"
    service: str
    version: str


# --- Auth ------------------------------------------------------------------
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


# --- Departments + tasks ---------------------------------------------------
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


# --- Weekly reports + AI ---------------------------------------------------
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
    """AI-drafted report sections. available=False ⇒ gateway unconfigured/unreachable."""
    available: bool = True
    completed_summary: str | None = None
    progress_summary: str | None = None
    next_week_plan: str | None = None
    note: str | None = None


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


# --- Executive analytics ---------------------------------------------------
class ExecDeptStat(BaseModel):
    dept_id: str
    dept_key: str
    name_en: str
    name_mk: str
    total: int = 0
    done: int = 0
    stuck: int = 0
    completion: int = 0


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
    headcount: int = 0
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
    sources: list[str] = []
    note: str | None = None
