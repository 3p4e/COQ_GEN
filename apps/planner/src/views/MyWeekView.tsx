import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import { Button } from "../components";
import { getTelemetry, listTasks } from "../api/planner";
import type { Lang, PlannerDepartment, PlannerTask, PlannerTelemetry, UserOut } from "../types/models";
import { TaskCard } from "./TaskCard";
import { TelemetryBar } from "./TelemetryBar";
import { AddTaskModal } from "./AddTaskModal";

export function MyWeekView({
  currentUser, departments, users, weekStart, lang, t,
}: {
  currentUser: UserOut;
  departments: PlannerDepartment[];
  users: UserOut[];
  weekStart: string;
  lang: Lang;
  t: (k: string) => string;
}) {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [tele, setTele] = useState<PlannerTelemetry | null>(null);
  const [modal, setModal] = useState<{ open: boolean; task: PlannerTask | null }>({ open: false, task: null });

  const reload = useCallback(async () => {
    try {
      const [mine, telemetry] = await Promise.all([
        listTasks({ weekStart, ownerId: currentUser.id }),
        getTelemetry(weekStart),
      ]);
      setTasks(mine);
      setTele(telemetry);
    } catch {
      setTasks([]);
      setTele(null);
    }
  }, [weekStart, currentUser.id]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div>
      <TelemetryBar tele={tele} lang={lang} t={t} />
      <div style={headerRow}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("my_week")}</h2>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModal({ open: true, task: null })}>
          {t("new_task")}
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div style={empty}>{t("no_tasks")}</div>
      ) : (
        <div style={grid}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} departments={departments} lang={lang} t={t}
              onClick={() => setModal({ open: true, task })} />
          ))}
        </div>
      )}

      {modal.open && (
        <AddTaskModal
          task={modal.task}
          weekStart={weekStart}
          departments={departments}
          users={users}
          lang={lang}
          t={t}
          onClose={() => setModal({ open: false, task: null })}
          onSaved={() => { setModal({ open: false, task: null }); void reload(); }}
        />
      )}
    </div>
  );
}

const headerRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 };
const empty: CSSProperties = { padding: 40, textAlign: "center", color: "var(--text-tertiary)", background: "var(--surface-card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-lg)" };
