import { useEffect, useState, type CSSProperties } from "react";
import { Layers, FileText, AlertCircle, Award, Plus, type LucideIcon } from "lucide-react";
import { Badge } from "../components";
import { getDashboard } from "../api";
import type { DashboardSummary, BatchSummary, DocumentRef } from "../types/models";
import { batchBadge, certTypeBadge, fmtDate } from "./status";
import type { ViewId } from "../AppShell";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px" };

interface Kpi { key: string; label: string; value: number; sub?: string; icon: LucideIcon; fg: string; bg: string; }

function kpisFrom(d: DashboardSummary): Kpi[] {
  return [
    { key: "batches", label: "Batches In Testing", value: d.batches_in_testing, icon: Layers, fg: "var(--color-brand)", bg: "rgba(27,58,92,0.08)" },
    { key: "ecoas", label: "eCoAs Pending Review", value: d.ecoa_pending_review, sub: "within 5-WD window", icon: FileText, fg: "var(--status-info)", bg: "var(--status-info-bg)" },
    { key: "oos", label: "Open OOS", value: d.open_oos, sub: d.open_oos > 0 ? "CoQ blocked" : undefined, icon: AlertCircle, fg: "var(--status-fail)", bg: "var(--status-fail-bg)" },
    { key: "coqs", label: "CoQs Issued", value: d.coqs_issued_this_year, sub: "YTD", icon: Award, fg: "var(--color-accent-deep)", bg: "var(--color-accent-tint)" },
  ];
}

export function Dashboard({ onNavigate }: { onNavigate: (id: ViewId) => void }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getDashboard().then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  const kpis = data ? kpisFrom(data) : [];

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>QC certificate overview — MK GMP compliant batch documentation workflow</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {data
          ? kpis.map((k) => (
            <div key={k.key} style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--radius-lg)", background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", color: k.fg, flexShrink: 0 }}>
                <k.icon size={16} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>{k.value}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginTop: 1 }}>{k.label}</div>
                {k.sub && <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 2 }}>{k.sub}</div>}
              </div>
            </div>
          ))
          : [0, 1, 2, 3].map((i) => <SkeletonKpi key={i} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={card}>
          <SectionHead title="Recent Batches" linkLabel="View all →" onLink={() => onNavigate("batches")} />
          {data && data.recent_batches.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>{["Production Batch", "Packaging Batch", "Product", "Params", "Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.recent_batches.map((b: BatchSummary) => <BatchRow key={b.production_batch_number} b={b} onClick={() => onNavigate("batches")} />)}
              </tbody>
            </table>
          ) : (
            <Empty label={error ? "Core API unreachable." : "No batches yet."} hint={error ? undefined : "Batches appear once ingestion lands."} />
          )}
        </div>

        <div style={card}>
          <SectionHead title="Recent eCoAs" linkLabel="All docs →" onLink={() => onNavigate("ingestion")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data && data.recent_documents.length > 0 ? (
              data.recent_documents.map((d: DocumentRef) => <DocRow key={d.document_code} d={d} />)
            ) : (
              <Empty label={error ? "Core API unreachable." : "No documents yet."} hint={error ? undefined : "Import an eCoA to begin."} />
            )}
            <button onClick={() => onNavigate("ingestion")} style={importBtn}><Plus size={13} /> Import New eCoA</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BatchRow({ b, onClick }: { b: BatchSummary; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <tr onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ cursor: "pointer", background: hover ? "var(--zebra)" : "transparent" }}>
      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--color-brand)" }}>{b.production_batch_number}</td>
      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-quaternary)" }}>{b.packaging_batch_number ?? "—"}</td>
      <td style={{ ...tdStyle, color: "var(--text-primary)" }}>{b.product_name}</td>
      <td style={{ ...tdStyle, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{b.params_conforming}/{b.params_total}</td>
      <td style={tdStyle}><Badge status={batchBadge(b.status)} size="sm" label={b.status} /></td>
    </tr>
  );
}

function DocRow({ d }: { d: DocumentRef }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{d.document_code}</span>
        <Badge status={certTypeBadge(d.cert_type)} size="sm" dot={false} label={d.cert_type} />
      </div>
      {d.institution_name && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.institution_name}{d.lab_code ? ` · ${d.lab_code}` : ""}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-quaternary)" }}>{d.batch_number ?? "—"}</span>
        <span style={{ fontSize: 10, color: "var(--text-quaternary)" }}>{fmtDate(d.issue_date)}</span>
      </div>
    </div>
  );
}

function SectionHead({ title, linkLabel, onLink }: { title: string; linkLabel: string; onLink: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
      <button onClick={onLink} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-brand)", fontWeight: 500, fontFamily: "var(--font-sans)" }}>{linkLabel}</button>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div style={{ ...card, display: "flex", gap: 12, alignItems: "flex-start", opacity: 0.6 }}>
      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-lg)", background: "var(--zebra)", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 28, height: 22, background: "var(--zebra)", borderRadius: 4 }} />
        <div style={{ width: "80%", height: 10, background: "var(--zebra)", borderRadius: 4, marginTop: 6 }} />
      </div>
    </div>
  );
}

function Empty({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const thStyle: CSSProperties = { padding: "6px 10px", textAlign: "left", background: "var(--zebra-head)", borderBottom: "1px solid var(--border-strong)", color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" };
const importBtn: CSSProperties = { width: "100%", padding: 8, border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-md)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--text-brand)", fontFamily: "var(--font-sans)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 };
