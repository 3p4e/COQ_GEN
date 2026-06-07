import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { GitBranch, ChevronRight, Award } from "lucide-react";
import { Badge, Button } from "../components";
import { listBatches, getBatch, getMasterParameters } from "../api";
import type { BatchSummary, Batch, MasterParameterLine } from "../types/models";
import { verdictBadge, batchBadge, fmtDate } from "./status";
import type { ViewId } from "../AppShell";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" };
const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

export function BatchRecord({ onNavigate }: { onNavigate: (id: ViewId) => void }) {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [params, setParams] = useState<MasterParameterLine[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    listBatches().then((b) => {
      if (!alive) return;
      setBatches(b);
      if (b.length > 0) setSelected(b[0].production_batch_number);
    }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setBatch(null); setParams(null);
    getBatch(selected).then((b) => alive && setBatch(b)).catch(() => {});
    getMasterParameters(selected).then((p) => alive && setParams(p)).catch(() => alive && setParams([]));
    return () => { alive = false; };
  }, [selected]);

  const oosCount = useMemo(() => (params ?? []).filter((p) => p.verdict === "fail").length, [params]);
  const conformCount = useMemo(() => (params ?? []).filter((p) => p.verdict === "pass").length, [params]);

  if (batches.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.3px", marginBottom: 16 }}>Batch Records</h1>
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>{error ? "Core API unreachable." : "No batches yet — they appear once ingestion lands."}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>{batch?.production_batch_number ?? selected}</h1>
            {batch && <Badge status={batchBadge(batch.status)} size="md" label={batch.status} />}
            {oosCount > 0 && <Badge status="oos" size="md" label={`${oosCount} OOS`} />}
          </div>
          {batch && <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>{batch.product_name}{batch.strain ? ` · ${batch.strain}` : ""}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)} style={pickerStyle}>
            {batches.map((b) => <option key={b.production_batch_number} value={b.production_batch_number}>{b.production_batch_number}</option>)}
          </select>
          <Button variant="primary" size="md" icon={<Award size={13} />} onClick={() => onNavigate("gen")} disabled={oosCount > 0}>Generate CoQ</Button>
        </div>
      </div>

      {batch && (
        <div style={{ ...card, padding: "12px 20px", marginBottom: 12, display: "flex" }}>
          {([
            ["Production Date", fmtDate(batch.production_date)],
            ["Specification", batch.spec_reference ?? (batch.spec_code ? `${batch.spec_code} ${batch.spec_version ?? ""}` : "—")],
            ["Grade", batch.grade ? `${batch.grade}${batch.grade_designation ? ` · ${batch.grade_designation}` : ""}` : "—"],
            ["Dominance", batch.dominance ?? "—"],
            ["Quantity", batch.quantity_kg != null ? `${batch.quantity_kg} kg` : "—"],
            ["Parameters", params ? `${conformCount} conform / ${oosCount} OOS / ${params.length} total` : "…"],
          ] as const).map(([k, v], i, arr) => (
            <div key={k} style={{ flex: 1, padding: "0 16px", borderRight: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none", ...(i === 0 ? { paddingLeft: 0 } : {}) }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {batch && (
        <div style={{ ...card, padding: "10px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <GitBranch size={13} style={{ color: "var(--text-quaternary)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "var(--text-quaternary)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginRight: 8 }}>Lineage</span>
          <Lin label="Cultivation" code={batch.lineage.cultivation_batch_number} color="var(--color-brand-soft)" />
          <ChevronRight size={12} style={{ color: "var(--text-quaternary)" }} />
          <Lin label="Production" code={batch.lineage.production_batch_number} color="var(--color-brand)" />
          {batch.lineage.packaging_batch_numbers.length > 0 && <ChevronRight size={12} style={{ color: "var(--text-quaternary)" }} />}
          {batch.lineage.packaging_batch_numbers.map((p) => <Lin key={p} label="Packaging" code={p} color="var(--color-accent-deep)" />)}
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>{["Parameter", "Acceptance Criteria", "Result", "Verdict", "Source Laboratory", "Source Document", "Date"].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {params == null ? (
              <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-quaternary)", fontSize: 13 }}>Loading parameters…</td></tr>
            ) : params.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>No parameters captured for this batch yet.</td></tr>
            ) : (
              params.map((p, i) => <ParamRow key={p.canonical_key ?? `${p.param_name}-${i}`} p={p} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParamRow({ p }: { p: MasterParameterLine }) {
  const [hover, setHover] = useState(false);
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ background: hover ? "var(--zebra)" : "transparent" }}>
      <td style={{ ...tdStyle, ...mono, fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{p.param_name}</td>
      <td style={{ ...tdStyle, ...mono, fontSize: 11, color: "var(--text-tertiary)" }}>{p.acceptance_text ?? "—"}</td>
      <td style={{ ...tdStyle, ...mono, fontSize: 11, fontWeight: 600, color: p.verdict === "fail" ? "var(--status-fail)" : "var(--text-primary)" }}>{p.result_display ?? "—"}{p.unit ? ` ${p.unit}` : ""}</td>
      <td style={tdStyle}><Badge status={verdictBadge(p.verdict)} size="sm" /></td>
      <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-tertiary)" }}>{p.source_institution_name ?? "—"}{p.source_lab_code ? ` · ${p.source_lab_code}` : ""}</td>
      <td style={{ ...tdStyle, ...mono, fontSize: 11, color: "var(--status-info)" }}>{p.source_document_code ?? "—"}</td>
      <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-quaternary)", whiteSpace: "nowrap" }}>{fmtDate(p.source_document_date)}</td>
    </tr>
  );
}

function Lin({ label, code, color }: { label: string; code?: string | null; color: string }) {
  if (!code) return null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "var(--zebra)", borderRadius: "var(--radius-full)", border: "1px solid var(--border-subtle)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ ...mono, fontSize: 10, color: "var(--text-primary)", fontWeight: 600 }}>{code}</span>
    </span>
  );
}

const thStyle: CSSProperties = { padding: "6px 12px", textAlign: "left", background: "var(--zebra-head)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-strong)", color: "var(--text-tertiary)", fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" };
const pickerStyle: CSSProperties = { padding: "6px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: 12, fontFamily: "var(--font-mono)", background: "var(--surface-card)", color: "var(--text-primary)", cursor: "pointer" };
