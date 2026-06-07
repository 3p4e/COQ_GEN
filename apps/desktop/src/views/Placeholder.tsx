import type { CSSProperties } from "react";

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px", marginBottom: 4 }}>{title}</h1>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>Planned surface — wiring pending.</p>
      <div style={box}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 520 }}>{note}</div>
      </div>
    </div>
  );
}

const box: CSSProperties = { background: "var(--surface-card)", border: "1px dashed var(--border-strong)", borderRadius: "var(--radius-lg)", padding: 40, textAlign: "center" };
