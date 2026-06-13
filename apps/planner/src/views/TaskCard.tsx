import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, GitBranch, MessageSquare } from "lucide-react";
import { Badge } from "../components";
import type { Lang, PlannerDepartment, PlannerTask } from "../types/models";
import { dayLabel } from "../i18n";
import { priorityBadge, statusBadge } from "./status";

export function TaskCard({
  task, departments, lang, t, onClick,
}: {
  task: PlannerTask;
  departments: PlannerDepartment[];
  lang: Lang;
  t: (k: string) => string;
  onClick: () => void;
}) {
  const dept = departments.find((d) => d.id === task.department_id);
  const deptName = dept ? (lang === "mk" ? dept.name_mk : dept.name_en) : task.department_key ?? "";
  const subTotal = task.subtasks.length;
  const subDone = task.subtasks.filter((s) => s.done).length;

  return (
    <div style={card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}>
      <span style={{ ...stripe, background: dept?.color ?? "var(--color-brand)" }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <Badge status={statusBadge(task.status)} size="sm" label={t(task.status)} />
          <Badge status={priorityBadge(task.priority)} size="sm" label={task.priority} dot={false} />
          <span style={{ marginLeft: "auto", fontSize: 10, color: dept?.color ?? "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{deptName}</span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35, marginBottom: 6 }}>{task.title}</div>

        {task.blocker && (
          <div style={blockerBox}><AlertTriangle size={12} /> {task.blocker}</div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {task.owner_name && <span style={ownerChip}>{task.owner_name}</span>}
          {task.days.length > 0 && (
            <span style={{ display: "flex", gap: 3 }}>
              {task.days.map((d) => <span key={d} style={dayChip}>{dayLabel(d, lang)}</span>)}
            </span>
          )}
          {subTotal > 0 && <Meta icon={<span style={{ fontSize: 11 }}>☑</span>} text={`${subDone}/${subTotal}`} />}
          {task.notes.length > 0 && <Meta icon={<MessageSquare size={11} />} text={String(task.notes.length)} />}
          {task.handoffs.length > 0 && <Meta icon={<GitBranch size={11} />} text={String(task.handoffs.length)} />}
        </div>

        {task.tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {task.tags.map((tag) => <span key={tag} style={tagChip}>{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-tertiary)" }}>
      {icon}{text}
    </span>
  );
}

const card: CSSProperties = { position: "relative", background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "10px 12px", cursor: "pointer", overflow: "hidden" };
const stripe: CSSProperties = { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 };
const blockerBox: CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--status-fail)", background: "var(--status-fail-bg)", border: "1px solid var(--status-fail-border)", borderRadius: "var(--radius-sm)", padding: "3px 6px", marginBottom: 6 };
const ownerChip: CSSProperties = { fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 };
const dayChip: CSSProperties = { fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", background: "var(--zebra, var(--color-slate-100))", borderRadius: "var(--radius-sm)", padding: "1px 5px" };
const tagChip: CSSProperties = { fontSize: 9, fontWeight: 600, color: "var(--color-accent-deep)", background: "var(--color-accent-tint)", borderRadius: "var(--radius-full)", padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.04em" };
