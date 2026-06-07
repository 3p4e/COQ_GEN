import { useState, type CSSProperties } from "react";
import { UploadCloud, Cpu, FlaskConical, Layers, CheckCircle2, Check, FileUp, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "../components";
import { ingest } from "../api";
import type { IngestAccepted } from "../types/models";

type Stage = "upload" | "processing" | "review";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 20 };

const PIPELINE = [
  { label: "Upload", desc: "PDF received", icon: FileUp, at: 0 },
  { label: "OCR", desc: "Vision parse", icon: Cpu, at: 45 },
  { label: "Extract", desc: "Agent fields", icon: FlaskConical, at: 72 },
  { label: "Map", desc: "Spec match", icon: Layers, at: 94 },
  { label: "Index", desc: "Store + embed", icon: CheckCircle2, at: 100 },
];

export function IngestionView() {
  const [stage, setStage] = useState<Stage>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<IngestAccepted | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (filenames: string[]) => {
    setStage("processing"); setProgress(0); setError(null);
    const steps = [12, 28, 45, 60, 72, 85, 94, 100];
    let i = 0;
    const tick = () => {
      if (i < steps.length) { setProgress(steps[i]); i++; setTimeout(tick, 360); }
      else {
        ingest(filenames, undefined)
          .then((r) => { setResult(r); setStage("review"); })
          .catch(() => { setError("Ingest endpoint unreachable — start the sidecar (make api)."); setStage("review"); });
      }
    };
    tick();
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>eCoA Ingestion</h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>Import external Certificates of Analysis — AI OCR pipeline → Annex A03 mandatory review</p>
        </div>
        {stage === "review" && <Button variant="secondary" icon={<Plus size={13} />} onClick={() => { setStage("upload"); setProgress(0); setResult(null); }}>New Import</Button>}
      </div>

      {stage === "upload" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const names = Array.from(e.dataTransfer.files).map((f) => f.name); run(names.length ? names : ["eCoA.pdf"]); }}
            onClick={() => run(["eCoA.pdf"])}
            style={{ ...card, border: `2px dashed ${dragOver ? "var(--color-brand)" : "var(--border-strong)"}`, background: dragOver ? "rgba(27,58,92,0.04)" : "var(--surface-card)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 280, gap: 12, transition: "var(--transition-ui)" }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "var(--radius-xl)", background: "rgba(27,58,92,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-brand)" }}><UploadCloud size={24} /></div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Drop eCoA PDF here</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Or click to browse · scanned or digital PDF</div>
            </div>
          </div>
          <div style={{ ...card, background: "rgba(27,58,92,0.04)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Cpu size={14} style={{ color: "var(--color-brand)", flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>AI Ingestion Pipeline</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, lineHeight: 1.5 }}>Routed through the Letta gateway (suitable-agent allow-list). OCR with visual context handles scanned and digital PDFs; extracted fields land in the Annex A03 review for PP QC determination.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "processing" && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Processing eCoA…</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20 }}>OCR · extract · map · index — via Letta agents on KVM4</div>
          <div style={{ height: 6, background: "var(--zebra-head)", borderRadius: "var(--radius-full)", marginBottom: 20, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-brand)", borderRadius: "var(--radius-full)", transition: "width 340ms var(--ease-out)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {PIPELINE.map((s, i) => {
              const done = progress >= s.at;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: done ? "var(--color-brand)" : "var(--zebra-head)", color: done ? "#fff" : "var(--text-quaternary)", display: "flex", alignItems: "center", justifyContent: "center", transition: "var(--transition-ui)" }}>
                    {done ? <Check size={16} /> : <s.icon size={16} />}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: done ? "var(--text-primary)" : "var(--text-quaternary)" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-quaternary)" }}>{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stage === "review" && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ClipboardCheck size={18} style={{ color: "var(--color-brand)" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Annex A03 — eCoA Mandatory Review</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>QCSOP 012 §6.3.2 · PP QC determines conformance (never copied from the eCoA) · within 5 working days</div>
            </div>
          </div>

          {error ? (
            <div style={{ padding: "10px 12px", background: "var(--status-pending-bg)", border: "1px solid var(--status-pending-border)", borderRadius: "var(--radius-md)", color: "var(--status-pending)", fontSize: 12 }}>{error}</div>
          ) : result ? (
            <div>
              <div style={{ display: "flex", gap: 20, padding: "12px 0", borderBottom: "1px solid var(--border-subtle)", marginBottom: 12 }}>
                <Stat label="Documents received" value={String(result.received)} />
                <Stat label="Codes assigned" value={result.document_codes.length ? result.document_codes.join(", ") : "—"} mono />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 14 }}>{result.note}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" size="md">Edit Fields</Button>
                <Button variant="primary" size="md" icon={<Check size={13} />}>Confirm &amp; Accept (A03)</Button>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-quaternary)" }}>
                On accept: register entry updates to <strong>eCoA · Accepted</strong> (QCLB 020); parameters flow into the batch master record. Full A03 checklist binds to <code style={{ fontFamily: "var(--font-mono)" }}>GET /checklists/a03/{`{docId}`}</code> when shipped.
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-quaternary)", fontSize: 13 }}>Loading…</div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-quaternary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>{value}</div>
    </div>
  );
}
