import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Search } from "lucide-react";
import { Badge, DataTable, type Column } from "../components";
import { listRegister } from "../api";
import type { RegisterEntry } from "../types/models";
import { registerBadge, certTypeBadge, fmtDate } from "./status";

const STATUS_FILTERS = ["issued", "accepted", "draft", "pending_review", "rejected", "superseded", "voided", "destroyed"] as const;
const STATUS_LABEL: Record<string, string> = {
  issued: "Issued", accepted: "Accepted", draft: "Draft", pending_review: "Pending Review",
  rejected: "Rejected", superseded: "Superseded", voided: "Voided", destroyed: "Destroyed",
};

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" };
const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

type Row = RegisterEntry & { id: string };

export function CertRegister() {
  const [rows, setRows] = useState<RegisterEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    let alive = true;
    listRegister().then((r) => alive && setRows(r)).catch(() => { if (alive) { setError(true); setRows([]); } });
    return () => { alive = false; };
  }, []);

  const q = search.toLowerCase();
  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!filterType || r.cert_type === filterType) &&
    (!filterStatus || r.status === filterStatus) &&
    (!q || [r.certificate_number, r.batch_no, r.product_name, r.spec_ref].filter(Boolean).join(" ").toLowerCase().includes(q))
  ), [rows, filterType, filterStatus, q]);

  const columns: Column<Row>[] = [
    { key: "certificate_number", header: "Certificate Number", render: (v) => <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: "var(--color-brand)" }}>{v as string}</span> },
    { key: "cert_type", header: "Type", render: (v) => <Badge status={certTypeBadge(v as string)} size="sm" dot={false} label={v as string} /> },
    { key: "status", header: "Status", render: (v) => <Badge status={registerBadge(v as string)} size="sm" label={STATUS_LABEL[v as string] ?? (v as string)} /> },
    { key: "batch_no", header: "Batch", render: (v) => <span style={{ ...mono, fontSize: 10, color: "var(--text-tertiary)" }}>{(v as string) ?? "—"}</span> },
    { key: "product_name", header: "Product", render: (v) => <span style={{ fontSize: 11, color: "var(--text-primary)" }}>{(v as string) ?? "—"}</span> },
    { key: "spec_ref", header: "Spec.", render: (v) => <span style={{ ...mono, fontSize: 10, color: "var(--text-quaternary)" }}>{(v as string) ?? "—"}</span> },
    { key: "issue_date", header: "Issue Date", render: (v) => <span style={{ fontSize: 11, color: "var(--text-quaternary)", whiteSpace: "nowrap" }}>{fmtDate(v as string)}</span> },
    { key: "prepared_by", header: "Prepared By", render: (v) => <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{(v as string) ?? "—"}</span> },
  ];

  const tableRows: Row[] = filtered.map((r) => ({ ...r, id: r.certificate_number }));

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Certificate Register</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>All iCoA · eCoA · CoQ records — QCSOP 012 v.03 §6.12 · monotone sequential per type per year</p>
      </header>

      <div style={{ ...card, padding: "10px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--zebra)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "5px 10px", flex: 1 }}>
          <Search size={13} style={{ color: "var(--text-quaternary)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search certificate, batch, product…" style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, fontFamily: "var(--font-sans)", color: "var(--text-primary)", width: "100%" }} />
        </div>
        {["", "CoQ", "eCoA", "iCoA"].map((tp) => (
          <button key={tp || "all"} onClick={() => setFilterType(tp)} style={chip(filterType === tp)}>{tp || "All"}</button>
        ))}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Status</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={tableRows} emptyMessage={rows == null ? "Loading…" : error ? "Core API unreachable." : "No certificates yet — register fills as iCoA/eCoA/CoQ are issued."} />

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-quaternary)", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
        <span>{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        <span>QCLB 020 · gaps = data-integrity events (ALCOA+) · deviations → QASOP 010</span>
      </div>
    </div>
  );
}

const chip = (active: boolean): CSSProperties => ({
  padding: "5px 12px", borderRadius: "var(--radius-md)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
  background: active ? "var(--color-brand)" : "var(--surface-card)", color: active ? "var(--text-inverse)" : "var(--text-tertiary)",
  border: `1px solid ${active ? "var(--color-brand)" : "var(--border-strong)"}`,
});
const selectStyle: CSSProperties = { padding: "5px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: 11, fontFamily: "var(--font-sans)", background: "var(--surface-card)", color: "var(--text-tertiary)", cursor: "pointer" };
