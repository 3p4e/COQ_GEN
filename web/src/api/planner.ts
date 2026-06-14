/* Typed wrappers over the planner endpoints. */
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, setToken } from "./client";
import type {
  AiDraftResult,
  ExecInsight,
  ExecTelemetry,
  PlannerDepartment,
  PlannerTask,
  PlannerTaskCreate,
  PlannerTaskUpdate,
  PlannerTelemetry,
  PlannerWeeklyReport,
  PlannerWeeklyReportUpdate,
  RewriteResult,
  RolloverResult,
  Token,
  UserOut,
} from "../types/models";

/* ── Auth ─────────────────────────────────────────────────────────────────*/
export async function login(username: string, password: string): Promise<Token> {
  const t = await apiPost<Token>("/auth/login", { username, password });
  setToken(t.access_token);
  return t;
}
export const me = (): Promise<UserOut> => apiGet<UserOut>("/auth/me");
export const logout = (): void => setToken(null);

/* ── Reference ────────────────────────────────────────────────────────────*/
export const listDepartments = (): Promise<PlannerDepartment[]> =>
  apiGet<PlannerDepartment[]>("/planner/departments");
export const listUsers = (): Promise<UserOut[]> => apiGet<UserOut[]>("/planner/users");

/* ── Tasks ────────────────────────────────────────────────────────────────*/
export function listTasks(opts: {
  weekStart?: string;
  departmentId?: string;
  ownerId?: string;
} = {}): Promise<PlannerTask[]> {
  const q = new URLSearchParams();
  if (opts.weekStart) q.set("week_start", opts.weekStart);
  if (opts.departmentId) q.set("department_id", opts.departmentId);
  if (opts.ownerId) q.set("owner_id", opts.ownerId);
  const qs = q.toString();
  return apiGet<PlannerTask[]>(`/planner/tasks${qs ? `?${qs}` : ""}`);
}
export const getTask = (id: string): Promise<PlannerTask> => apiGet<PlannerTask>(`/planner/tasks/${id}`);
export const createTask = (body: PlannerTaskCreate): Promise<PlannerTask> =>
  apiPost<PlannerTask>("/planner/tasks", body);
export const updateTask = (id: string, body: PlannerTaskUpdate): Promise<PlannerTask> =>
  apiPatch<PlannerTask>(`/planner/tasks/${id}`, body);
export const deleteTask = (id: string): Promise<void> => apiDelete(`/planner/tasks/${id}`);
export const addNote = (id: string, note: string, day?: string): Promise<PlannerTask> =>
  apiPost<PlannerTask>(`/planner/tasks/${id}/notes`, { note, day: day ?? null });
export const addHandoff = (id: string, toDepartmentId: string): Promise<PlannerTask> =>
  apiPost<PlannerTask>(`/planner/tasks/${id}/handoffs`, { to_department_id: toDepartmentId });

/* ── Telemetry ────────────────────────────────────────────────────────────*/
export const getTelemetry = (weekStart: string): Promise<PlannerTelemetry> =>
  apiGet<PlannerTelemetry>(`/planner/telemetry?week_start=${weekStart}`);

/* ── Weekly reports + AI ──────────────────────────────────────────────────*/
export const getReport = (weekStart: string): Promise<PlannerWeeklyReport> =>
  apiGet<PlannerWeeklyReport>(`/planner/reports?week_start=${weekStart}`);
export const saveReport = (weekStart: string, body: PlannerWeeklyReportUpdate): Promise<PlannerWeeklyReport> =>
  apiPut<PlannerWeeklyReport>(`/planner/reports?week_start=${weekStart}`, body);
export const submitReport = (weekStart: string, body: PlannerWeeklyReportUpdate): Promise<PlannerWeeklyReport> =>
  apiPost<PlannerWeeklyReport>(`/planner/reports/submit?week_start=${weekStart}`, body);
export const aiDraftReport = (weekStart: string): Promise<AiDraftResult> =>
  apiPost<AiDraftResult>(`/planner/reports/ai-draft?week_start=${weekStart}`);
export const rolloverWeek = (weekStart: string): Promise<RolloverResult> =>
  apiPost<RolloverResult>(`/planner/reports/rollover?week_start=${weekStart}`);
export const aiRewrite = (text: string, tone = "concise"): Promise<RewriteResult> =>
  apiPost<RewriteResult>("/planner/ai/rewrite", { text, tone });

/* ── Executive analytics ──────────────────────────────────────────────────*/
export const getExecTelemetry = (weekStart: string): Promise<ExecTelemetry> =>
  apiGet<ExecTelemetry>(`/planner/exec/telemetry?week_start=${weekStart}`);
export const getExecInsights = (weekStart: string): Promise<ExecInsight> =>
  apiPost<ExecInsight>(`/planner/exec/insights?week_start=${weekStart}`);
