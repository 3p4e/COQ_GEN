/* Planner API shapes — mirror packages/schemas/coqgen_schemas (planner section).
   Hand-authored for now; `make gen-types-planner` can regenerate from OpenAPI later. */

export type TaskStatus = "pending" | "working" | "review" | "stuck" | "postponed" | "done";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type Role = "operator" | "hod" | "qa" | "qp" | "executive" | "admin";
export type Lang = "en" | "mk";

export interface UserOut {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  email?: string | null;
  avatar_url?: string | null;
  dept_id?: string | null;
  dept_key?: string | null;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: UserOut;
}

export interface PlannerDepartment {
  id: string;
  key: string;
  name_en: string;
  name_mk: string;
  icon?: string | null;
  color?: string | null;
  handoff_to_id?: string | null;
  position: number;
}

export interface PlannerSubtask {
  id?: string | null;
  text: string;
  done: boolean;
  position: number;
}

export interface PlannerProgressNote {
  id: string;
  day?: string | null;
  note: string;
  author_id?: string | null;
  author_name?: string | null;
  created_at?: string | null;
}

export interface PlannerHandoff {
  id: string;
  to_department_id: string;
  to_department_key?: string | null;
  status: string;
  requested_by?: string | null;
  created_at?: string | null;
}

export interface PlannerTask {
  id: string;
  department_id: string;
  department_key?: string | null;
  title: string;
  owner_id?: string | null;
  owner_name?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  week_start: string;
  days: string[];
  room?: string | null;
  batch?: string | null;
  tags: string[];
  description?: string | null;
  blocker?: string | null;
  position: number;
  helper_ids: string[];
  subtasks: PlannerSubtask[];
  notes: PlannerProgressNote[];
  deps: string[];
  handoffs: PlannerHandoff[];
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
}

export interface PlannerTaskCreate {
  department_id: string;
  title: string;
  week_start: string;
  owner_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  days?: string[];
  room?: string | null;
  batch?: string | null;
  tags?: string[];
  description?: string | null;
  blocker?: string | null;
  helper_ids?: string[];
  subtasks?: PlannerSubtask[];
  deps?: string[];
}

export type PlannerTaskUpdate = Partial<Omit<PlannerTaskCreate, "department_id" | "week_start">> & {
  department_id?: string;
  week_start?: string;
  position?: number;
};

export interface PlannerTelemetry {
  week_start: string;
  total: number;
  completion: number;
  by_status: Record<string, number>;
  busiest_day?: string | null;
}
