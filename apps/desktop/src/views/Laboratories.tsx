import { useEffect, useState, type CSSProperties } from "react";
import { Building2, Globe } from "lucide-react";
import { listLabs } from "../api";
import type { LabInstitution } from "../types/models";

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "18px 20px" };

export function Laboratories() {
  const [labs, setLabs] = useState<LabInstitution[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    listLabs().then((l) => alive && setLabs(l)).catch(() => { if (alive) { setError(true); setLabs([]); } });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Laboratories</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>Registered external QC laboratories — eCoA source institutions under technical quality agreements</p>
      </header>

      {labs == null ? (
        <div style={{ ...card, color: "var(--text-quaternary)", fontSize: 13 }}>Loading…</div>
      ) : labs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, padding: 40 }}>{error ? "Core API unreachable." : "No laboratories registered yet."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {labs.map((lab, i) => (
            <div key={lab.lab_code ?? i} style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--status-info-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--status-info)", flexShrink: 0 }}>
                <Building2 size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{lab.name}</span>
                  {lab.lab_code && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-accent-deep)", background: "var(--color-accent-tint)", border: "1px solid #E7D6A8", borderRadius: "var(--radius-sm)", padding: "1px 7px" }}>{lab.lab_code}</span>}
                </div>
                {lab.address && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>{lab.address}</div>}
                <div style={{ display: "flex", gap: 20, fontSize: 11, flexWrap: "wrap" }}>
                  {lab.credentials && <Field label="Credentials" value={lab.credentials} />}
                  {lab.default_language && <Field label="Default language" value={lab.default_language} icon={<Globe size={11} />} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {icon}
      <span style={{ color: "var(--text-quaternary)" }}>{label}:</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
