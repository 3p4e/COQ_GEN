import { useCallback, useEffect, useState } from "react";
import { PlannerShell, type ViewId } from "./PlannerShell";
import { Login } from "./views/Login";
import { MyWeekView } from "./views/MyWeekView";
import { BoardView } from "./views/BoardView";
import { ReportsView } from "./views/ReportsView";
import { ComingSoon } from "./views/ComingSoon";
import { getToken } from "./api/client";
import { listDepartments, listUsers, logout, me } from "./api/planner";
import { makeT } from "./i18n";
import { addWeeks, mondayOf } from "./views/status";
import type { Lang, PlannerDepartment, UserOut } from "./types/models";

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [user, setUser] = useState<UserOut | null>(null);
  const [departments, setDepartments] = useState<PlannerDepartment[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [view, setView] = useState<ViewId>("myweek");
  const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
  const [booting, setBooting] = useState(true);

  const t = makeT(lang);

  const loadRefData = useCallback(async () => {
    const [depts, allUsers] = await Promise.all([listDepartments(), listUsers()]);
    setDepartments(depts);
    setUsers(allUsers);
  }, []);

  // Restore session from a stored token on first load.
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const u = await me();
          setUser(u);
          await loadRefData();
        } catch {
          setUser(null);
        }
      }
      setBooting(false);
    })();
  }, [loadRefData]);

  async function handleLogin(u: UserOut) {
    setUser(u);
    try {
      await loadRefData();
    } catch {
      /* ref data load failure surfaces as empty pickers; views show empty state */
    }
  }

  function handleLogout() {
    logout();
    setUser(null);
    setView("myweek");
  }

  if (booting) return null;
  if (!user) return <Login t={t} onLogin={handleLogin} />;

  return (
    <PlannerShell
      current={view}
      onNavigate={setView}
      user={user}
      lang={lang}
      onToggleLang={() => setLang((l) => (l === "en" ? "mk" : "en"))}
      t={t}
      weekStart={weekStart}
      onWeekStep={(delta) => setWeekStart((w) => addWeeks(w, delta))}
      onToday={() => setWeekStart(mondayOf(new Date()))}
      onLogout={handleLogout}
    >
      {view === "myweek" && (
        <MyWeekView currentUser={user} departments={departments} users={users} weekStart={weekStart} lang={lang} t={t} />
      )}
      {view === "board" && (
        <BoardView departments={departments} users={users} weekStart={weekStart} lang={lang} t={t} />
      )}
      {view === "reports" && <ReportsView weekStart={weekStart} t={t} />}
      {view === "executive" && <ComingSoon title={t("executive")} message={t("exec_soon")} />}
      {view === "settings" && <ComingSoon title={t("settings")} message={t("coming_soon")} />}
    </PlannerShell>
  );
}
