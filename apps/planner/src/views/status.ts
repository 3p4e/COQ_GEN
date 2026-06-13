/* Map planner status/priority onto the shared Badge tones, plus week helpers. */
import type { BadgeStatus } from "../components";
import type { TaskStatus, TaskPriority } from "../types/models";

export function statusBadge(status: TaskStatus): BadgeStatus {
  switch (status) {
    case "done":
      return "conforms";
    case "working":
      return "review";
    case "review":
      return "issued";
    case "stuck":
      return "oos";
    case "postponed":
      return "pending";
    case "pending":
    default:
      return "draft";
  }
}

export function priorityBadge(priority: TaskPriority): BadgeStatus {
  switch (priority) {
    case "critical":
      return "oos";
    case "high":
      return "pending";
    case "medium":
      return "review";
    case "low":
    default:
      return "na";
  }
}

/** Monday (ISO) of the week containing `d`, as YYYY-MM-DD. */
export function mondayOf(d: Date): string {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return toISODate(x);
}

export function addWeeks(isoMonday: string, weeks: number): string {
  const x = new Date(isoMonday + "T00:00:00");
  x.setDate(x.getDate() + weeks * 7);
  return toISODate(x);
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Jun 8 – Jun 14" label for the week starting at `isoMonday`. */
export function weekLabel(isoMonday: string): string {
  const s = new Date(isoMonday + "T00:00:00");
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}
