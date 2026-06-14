import { useState, type ReactNode, type CSSProperties } from "react";
import {
  CalendarDays, LayoutGrid, FileText, BarChart3, Settings2,
  ChevronLeft, ChevronRight, LogOut, Globe, type LucideIcon,
} from "lucide-react";
import type { Lang, UserOut } from "./types/models";
import { weekLabel } from "./views/status";

export type ViewId = "myweek" | "board" | "reports" | "executive" | "settings";

interface NavItem { id: ViewId; key: string; Icon: LucideIcon; execOnly?: boolean; }

const NAV: NavItem[] = [
  { id: "myweek", key: "my_week", Icon: CalendarDays },
  { id: "board", key: "board", Icon: LayoutGrid },
  { id: "reports", key: "reports", Icon: FileText },
  { id: "executive", key: "executive", Icon: BarChart3, execOnly: true },
];

export interface PlannerShellProps {
  current: ViewId;
  onNavigate: (id: ViewId) => void;
  user: UserOut;
  lang: Lang;
  onToggleLang: () => void;
  t: (k: string) => string;
  weekStart: string;
  onWeekStep: (delta: number) => void;
  onToday: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export function PlannerShell(props: PlannerShellProps) {
  const { current, onNavigate, user, lang, onToggleLang, t, weekStart, onWeekStep, onToday, onLogout, children } = props;
  const isExec = user.role === "executive" || user.role === "admin";
  const items = NAV.filter((n) => !n.execOnly || isExec);

  return (
    <>
      <nav style={sidebar}>
        <div style={logoArea}>
          <BrandMark />
          <div>
            <div style={{ color: "var(--text-inverse)", fontSize: 14, fontWeight: 600 }}>{t("app_name")}</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>GrowFlow</div>
          </div>
        </div>

        <div style={navList}>
          {items.map((item) => (
            <NavButton key={item.id} label={t(item.key)} Icon={item.Icon} active={current === item.id} onClick={() => onNavigate(item.id)} />
          ))}
        </div>

        <div style={{ padding: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <NavButton label={t("settings")} Icon={Settings2} active={current === "settings"} onClick={() => onNavigate("settings")} />
          <div style={userRow}>
            <div style={avatar}>{initials(user.full_name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.full_name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{user.role}</div>
            </div>
            <button title={t("logout")} onClick={onLogout} style={iconBtnDark}><LogOut size={13} /></button>
          </div>
        </div>
      </nav>

      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button style={weekBtn} onClick={() => onWeekStep(-1)} title={t("prev_week")}><ChevronLeft size={15} /></button>
          <div style={{ minWidth: 150, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{weekLabel(weekStart)}</div>
          <button style={weekBtn} onClick={() => onWeekStep(1)} title={t("next_week")}><ChevronRight size={15} /></button>
          <button style={todayBtn} onClick={onToday}>{t("today")}</button>
        </div>
        <div style={{ flex: 1 }} />
        <button style={langBtn} onClick={onToggleLang} title={t("language")}>
          <Globe size={13} /> {lang === "en" ? "EN" : "МК"}
        </button>
      </header>

      <main style={content}>{children}</main>
    </>
  );
}

function NavButton({ label, Icon, active, onClick }: { label: string; Icon: LucideIcon; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px",
        borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: active ? 500 : 400,
        background: active ? "var(--surface-sidebar-active)" : hover ? "rgba(255,255,255,0.07)" : "transparent",
        color: active ? "var(--text-inverse)" : hover ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
        transition: "var(--transition-ui)",
        boxShadow: active ? "inset 2px 0 0 var(--color-accent-bright)" : undefined,
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function BrandMark() {
  return (
    <svg width={28} height={28} viewBox="0 0 40 40" fill="none" aria-hidden>
      <polygon points="20,2 34,10 34,26 20,34 6,26 6,10" fill="#0F2540" />
      <polygon points="20,7 30,13 30,23 20,29 10,23 10,13" fill="#1B3A5C" />
      <path d="M20 12 C20 12 13 19 20 28 C27 19 20 12 20 12Z" fill="#C9A227" opacity={0.95} />
    </svg>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const sidebar: CSSProperties = { width: "var(--sidebar-width)", flexShrink: 0, background: "var(--surface-sidebar)", display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 10 };
const logoArea: CSSProperties = { padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 };
const navList: CSSProperties = { flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" };
const userRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 2px" };
const avatar: CSSProperties = { width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-brand-mid)", color: "var(--text-inverse)", fontSize: 10, fontWeight: 600 };
const iconBtnDark: CSSProperties = { width: 26, height: 26, borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const header: CSSProperties = { height: "var(--header-height)", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, position: "fixed", top: 0, left: "var(--sidebar-width)", right: 0, zIndex: 9 };
const weekBtn: CSSProperties = { width: 28, height: 28, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" };
const todayBtn: CSSProperties = { marginLeft: 6, padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" };
const langBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontSize: 12, color: "var(--text-tertiary)", cursor: "pointer" };
const content: CSSProperties = { marginLeft: "var(--sidebar-width)", marginTop: "var(--header-height)", minHeight: "calc(100vh - var(--header-height))", background: "var(--surface-app)", padding: 24 };
