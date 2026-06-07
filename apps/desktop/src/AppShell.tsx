import { useState, type ReactNode, type CSSProperties } from "react";
import {
  LayoutDashboard, UploadCloud, Layers, FilePlus2, FileText, AlertCircle,
  Building2, FlaskConical, FileCog, Settings2, Search, Bell, ChevronRight,
  type LucideIcon,
} from "lucide-react";

export type ViewId =
  | "dashboard" | "ingestion" | "batches" | "gen" | "register"
  | "oos" | "labs" | "parameters" | "templates" | "settings";

interface NavItem { id: ViewId; label: string; Icon: LucideIcon; }

const NAV: NavItem[] = [
  { id: "dashboard",  label: "Dashboard",          Icon: LayoutDashboard },
  { id: "ingestion",  label: "eCoA Ingestion",     Icon: UploadCloud },
  { id: "batches",    label: "Batch Records",      Icon: Layers },
  { id: "gen",        label: "Document Generator", Icon: FilePlus2 },
  { id: "register",   label: "Cert. Register",     Icon: FileText },
  { id: "oos",        label: "OOS / NCR",          Icon: AlertCircle },
  { id: "labs",       label: "Laboratories",       Icon: Building2 },
  { id: "parameters", label: "Parameter DB",       Icon: FlaskConical },
  { id: "templates",  label: "Templates",          Icon: FileCog },
];

const VIEW_LABELS: Record<ViewId, string> = {
  dashboard: "Dashboard", ingestion: "eCoA Ingestion", batches: "Batch Records",
  gen: "Document Generator", register: "Certificate Register", oos: "OOS Investigations",
  labs: "Laboratories", parameters: "Parameter Database", templates: "Document Templates", settings: "Settings",
};

export interface BatchContext { packaging_batch_no: string; processing_batch_no: string; status: string; }

export interface AppShellProps {
  current: ViewId;
  onNavigate: (id: ViewId) => void;
  batchContext?: BatchContext;
  children: ReactNode;
}

export function AppShell({ current, onNavigate, batchContext, children }: AppShellProps) {
  return (
    <>
      <nav style={sidebar}>
        <div style={logoArea}>
          <BrandMark />
          <div>
            <div style={{ color: "var(--text-inverse)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.2px" }}>COQ_GEN</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>QC Certificates</div>
          </div>
        </div>

        <div style={navList}>
          <div style={navHeading}>Workspace</div>
          {NAV.map((item) => <NavButton key={item.id} item={item} active={current === item.id} onClick={() => onNavigate(item.id)} />)}
        </div>

        {batchContext && (
          <div style={batchBadge}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Active Batch</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-inverse)" }}>{batchContext.packaging_batch_no}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{batchContext.processing_batch_no}</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-bright)", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{batchContext.status}</span>
            </div>
          </div>
        )}

        <div style={{ padding: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <NavButton item={{ id: "settings", label: "Settings", Icon: Settings2 }} active={current === "settings"} onClick={() => onNavigate("settings")} />
          <div style={{ padding: "8px 10px 2px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Certificate Signatories</div>
            <SignatoryRow initials="SA" role="Prepared by" name="Senior QC Analyst" />
            <SignatoryRow initials="QC" role="Reviewed &amp; Approved" name="Head of QC" gold />
          </div>
        </div>
      </nav>

      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-quaternary)", flex: 1 }}>
          <span>COQ_GEN</span>
          <ChevronRight size={13} />
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{VIEW_LABELS[current]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={searchBtn}><Search size={13} /> Search…</button>
          <button style={iconBtn}><Bell size={14} /></button>
        </div>
      </header>

      <main style={content}>{children}</main>
    </>
  );
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
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
      <item.Icon size={15} />
      {item.label}
    </button>
  );
}

function SignatoryRow({ initials, role, name, gold }: { initials: string; role: string; name: string; gold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: gold ? "var(--color-accent)" : "var(--color-brand-mid)", color: "var(--text-inverse)", fontSize: 9, fontWeight: 600 }}>{initials}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.78)", fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: name }} />
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)" }} dangerouslySetInnerHTML={{ __html: role }} />
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width={28} height={28} viewBox="0 0 40 40" fill="none" aria-hidden>
      <polygon points="20,2 34,10 34,26 20,34 6,26 6,10" fill="#0F2540" />
      <polygon points="20,7 30,13 30,23 20,29 10,23 10,13" fill="#1B3A5C" />
      <path d="M20 12 C20 12 13 19 20 28 C27 19 20 12 20 12Z" fill="#C9A227" opacity={0.95} />
      <line x1="20" y1="12" x2="20" y2="28" stroke="#0F2540" strokeWidth={1.1} opacity={0.5} />
    </svg>
  );
}

const sidebar: CSSProperties = { width: "var(--sidebar-width)", flexShrink: 0, background: "var(--surface-sidebar)", display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 10 };
const logoArea: CSSProperties = { padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 };
const navList: CSSProperties = { flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" };
const navHeading: CSSProperties = { fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 10px 4px" };
const batchBadge: CSSProperties = { margin: "0 10px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--radius-md)", padding: "8px 10px" };
const header: CSSProperties = { height: "var(--header-height)", background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, position: "fixed", top: 0, left: "var(--sidebar-width)", right: 0, zIndex: 9 };
const searchBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", fontSize: 12, color: "var(--text-tertiary)", cursor: "pointer" };
const iconBtn: CSSProperties = { width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-tertiary)" };
const content: CSSProperties = { marginLeft: "var(--sidebar-width)", marginTop: "var(--header-height)", minHeight: "calc(100vh - var(--header-height))", background: "var(--surface-app)", padding: 24 };
