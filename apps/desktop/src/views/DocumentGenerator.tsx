import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Award, AlertCircle, RefreshCw, Check, Download, FileText, FlaskConical } from "lucide-react";
import { Button, Badge } from "../components";
import { listBatches, getMasterParameters, listParameters } from "../api";
import { listTemplateVersions, previewDocument, issueDocument } from "../api/documents";
import type { BatchSummary, MasterParameterLine, ParameterDictionaryEntry, DocumentTemplate, DocType } from "../types/models";
import { verdictBadge } from "./status";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 20 };
const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

const META: Record<"icoa" | "coq", { label: string; title: string; scope: string; series: string }> = {
  icoa: { label: "iCoA", title: "Internal Certificate of Analysis", scope: "Internal QC parameters only (Appearance · Identification · Foreign Matter)", series: "iCoA-PP-YYYY-NNNN" },
  coq: { label: "CoQ", title: "Certificate of Quality", scope: "Aggregates all iCoA + eCoA results vs the approved specification", series: "CoQ-PP-YYYY-NNNN" },
};

export function DocumentGenerator({ initial = "coq" }: { initial?: "icoa" | "coq" }) {
  const [docType, setDocType] = useState<"icoa" | "coq">(initial);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchNo, setBatchNo] = useState("");
  const [params, setParams] = useState<MasterParameterLine[] | null>(null);
  const [internalKeys, setInternalKeys] = useState<Set<string>>(new Set());
  const [tpl, setTpl] = useState<DocumentTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  useEffect(() => {
    listBatches().then((b) => { setBatches(b); if (b[0]) setBatchNo(b[0].production_batch_number); }).catch(() => {});
    listParameters().then((ps: ParameterDictionaryEntry[]) => setInternalKeys(new Set(ps.filter((p) => p.default_source === "internal").map((p) => p.canonical_key)))).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    listTemplateVersions(docType as DocType).then((vs) => active && setTpl(vs.find((v) => v.is_active) ?? null)).catch(() => active && setTpl(null));
    return () => { active = false; };
  }, [docType]);

  useEffect(() => {
    if (!batchNo) return;
    let active = true; setParams(null);
    getMasterParameters(batchNo).then((p) => active && setParams(p)).catch(() => active && setParams([]));
    return () => { active = false; };
  }, [batchNo]);

  const scoped = useMemo(() => {
    if (params == null) return null;
    if (docType === "coq") return params;
    return params.filter((p) => p.canonical_key && internalKeys.has(p.canonical_key));
  }, [params, docType, internalKeys]);

  const oos = (scoped ?? []).filter((p) => p.verdict === "fail");
  const pending = (scoped ?? []).filter((p) => p.verdict === "pending" || p.verdict === "not_tested");
  const canIssue = scoped != null && scoped.length > 0 && oos.length === 0 && pending.length === 0 && !!tpl;

  const issue = () => {
    setBusy(true);
    previewDocument(docType, batchNo)
      .then(() => issueDocument(docType, batchNo, tpl?.version ?? ""))
      .then((r) => setIssued(r.certificate_number))
      .finally(() => setBusy(false));
  };

  const m = META[docType];

  if (issued) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, gap: 16, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-accent-tint)", border: "2px solid #E7D6A8", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-accent-deep)" }}><Award size={28} /></div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>{m.label} Issued</h2>
          <div style={{ ...mono, fontSize: 13, color: "var(--color-brand)", fontWeight: 600 }}>{issued}</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 4 }}>Registered in QCLB 020 · rendered from {tpl?.name} v{tpl?.version}. Two signatories, no QP.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" icon={<Download size={14} />}>Download PDF</Button>
          <Button variant="primary" onClick={() => setIssued(null)}>New Document</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Document Generator</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>Compile a controlled certificate from the batch master parameter record (QCSOP 012)</p>
      </header>

      <div style={{ display: "inline-flex", marginBottom: 16, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        {(["icoa", "coq"] as const).map((d) => (
          <button key={d} onClick={() => setDocType(d)} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "7px 18px", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "left", background: docType === d ? "var(--color-brand)" : "var(--surface-card)", color: docType === d ? "#fff" : "var(--text-tertiary)" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{META[d].label}</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>{META[d].title}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <Label>Template</Label>
            {tpl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <FileText size={16} style={{ color: "var(--text-tertiary)" }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{tpl.name}</span>
                <Badge status="issued" size="sm" dot={false} label={`v${tpl.version}`} />
                <Badge status="conforms" size="sm" label="Active" />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--status-pending)", display: "flex", gap: 6, alignItems: "center" }}>
                <AlertCircle size={13} /> No active {m.label} template — upload one in Document Templates first.
              </div>
            )}
          </div>

          <div style={card}>
            <Label>{`Parameters in scope — ${scoped?.length ?? "…"}`}</Label>
            <div style={{ fontSize: 11, color: "var(--text-quaternary)", marginBottom: 10 }}>{m.scope}</div>
            {oos.length > 0 && <Guard tone="fail"><strong>OOS detected ({oos.length}). </strong>Issuance blocked until the QCSOP 019 investigation closes (QCSOP 012 §6.4.1).</Guard>}
            {oos.length === 0 && pending.length > 0 && <Guard tone="pending"><strong>{pending.length} not yet tested. </strong>All in-scope parameters must be tested before issuing.</Guard>}
            {scoped && scoped.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {scoped.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span style={{ ...mono, fontSize: 11, fontWeight: 600 }}>{p.param_name}</span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ ...mono, fontSize: 11, color: p.verdict === "fail" ? "var(--status-fail)" : "var(--text-tertiary)" }}>{p.result_display ?? "—"}</span>
                      <Badge status={verdictBadge(p.verdict)} size="sm" dot={false} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            {scoped && scoped.length === 0 && params != null && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "8px 0" }}>
                {docType === "icoa" ? "No internal-source parameters captured for this batch yet." : "No parameters captured for this batch yet."}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <Label>Batch</Label>
            <select value={batchNo} onChange={(e) => setBatchNo(e.target.value)} style={selectStyle}>
              {batches.length === 0 && <option value="">No batches</option>}
              {batches.map((b) => <option key={b.production_batch_number} value={b.production_batch_number}>{b.production_batch_number}</option>)}
            </select>
            <div style={{ ...mono, fontSize: 11, color: "var(--text-quaternary)", marginTop: 8 }}>Number series: {m.series} (backend-assigned)</div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <Label>Signatories (no QP)</Label>
            <Sig who="Senior QC Analyst" role="Prepared by" />
            <Sig who="Head of QC" role="Reviewed &amp; Approved by" gold />
          </div>

          <Button variant={canIssue ? "primary" : "secondary"} size="lg" fullWidth disabled={!canIssue || busy} icon={busy ? <RefreshCw size={15} /> : <FlaskConical size={15} />} onClick={issue}>
            {busy ? `Issuing ${m.label}…` : oos.length > 0 ? "OOS — Cannot Issue" : pending.length > 0 ? "Awaiting Results" : !tpl ? "No Active Template" : `Generate & Issue ${m.label}`}
          </Button>
          {canIssue && <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--status-pass)" }}><Check size={12} /> In scope &amp; conforming — ready</div>}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{children}</div>;
}
function Guard({ tone, children }: { tone: "fail" | "pending"; children: React.ReactNode }) {
  const c = tone === "fail" ? ["var(--status-fail-bg)", "var(--status-fail-border)", "var(--status-fail)"] : ["var(--status-pending-bg)", "var(--status-pending-border)", "var(--status-pending)"];
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: c[0], border: `1px solid ${c[1]}`, borderRadius: "var(--radius-md)", marginBottom: 10, alignItems: "flex-start", color: c[2] }}>
      <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 11, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
function Sig({ who, role, gold }: { who: string; role: string; gold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: gold ? "var(--color-accent)" : "var(--color-brand-mid)", color: "#fff", fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{who.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{who}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }} dangerouslySetInnerHTML={{ __html: role }} />
      </div>
    </div>
  );
}

const selectStyle: CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: 12, fontFamily: "var(--font-mono)", background: "var(--surface-card)", color: "var(--text-primary)", cursor: "pointer" };
