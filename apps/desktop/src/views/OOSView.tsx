import { useEffect, useState, type CSSProperties } from "react";
import { AlertCircle, XCircle } from "lucide-react";
import { Badge } from "../components";
import { listOos } from "../api";
import type { OOSItem } from "../types/models";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)" };
const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

export function OOSView() {
  const [items, setItems] = useState<OOSItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    listOos().then((o) => alive && setItems(o)).catch(() => { if (alive) { setError(true); setItems([]); } });
    return () => { alive = false; };
  }, []);

  const open = (items ?? []).filter((i) => i.status === "open");
  const blockedBatches = Array.from(new Set(open.map((i) => i.batch_no).filter(Boolean)));

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>OOS Investigations</h1>
          {open.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: "var(--radius-full)", fontSize: 11, fontWeight: 700, background: "var(--status-fail-bg)", color: "var(--status-fail)", border: "1px solid var(--status-fail-border)" }}>
              <AlertCircle size={11} /> {open.length} open
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>Out of Specification results — QCSOP 019 · an open OOS blocks CoQ issuance for the affected batch</p>
      </header>

      {open.length > 0 && (
        <div style={{ ...card, padding: "12px 16px", marginBottom: 14, background: "var(--status-fail-bg)", border: "1px solid var(--status-fail-border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <XCircle size={16} style={{ color: "var(--status-fail)", flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-fail)", marginBottom: 3 }}>CoQ Compilation Blocked</div>
            <div style={{ fontSize: 12, color: "var(--status-fail)", lineHeight: 1.5 }}>
              Per QCSOP 012 §6.4.1, no CoQ may be compiled for a batch with an open OOS until the QCSOP 019 investigation reaches a decision.
              {blockedBatches.length > 0 && <> Blocked: <strong style={mono}>{blockedBatches.join(", ")}</strong>.</>}
            </div>
          </div>
        </div>
      )}

      {items == null ? (
        <div style={{ ...card, padding: 18, color: "var(--text-quaternary)", fontSize: 13 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>{error ? "Core API unreachable." : "No OOS results. Parameters within specification."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {items.map((o, i) => (
            <div key={i} style={{ ...card, padding: "14px 16px", borderLeft: o.status === "open" ? "3px solid var(--status-fail)" : "3px solid var(--border-strong)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{o.param_name}</span>
                <Badge status={o.status === "open" ? "oos" : "review"} size="sm" label={o.status} />
              </div>
              <Row k="Result" v={o.result_display ?? "—"} fail />
              <Row k="Acceptance" v={o.acceptance_text ?? "—"} />
              <Row k="Batch" v={o.batch_no ?? "—"} mono />
              <Row k="Source eCoA" v={o.source_document_code ?? "—"} mono />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono: isMono, fail }: { k: string; v: string; mono?: boolean; fail?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, gap: 8 }}>
      <span style={{ color: "var(--text-quaternary)", flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: isMono ? "var(--font-mono)" : "var(--font-sans)", color: fail ? "var(--status-fail)" : "var(--text-primary)", fontWeight: fail ? 700 : 400, textAlign: "right" }}>{v}</span>
    </div>
  );
}
