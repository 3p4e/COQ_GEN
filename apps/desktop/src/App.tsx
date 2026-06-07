import { useEffect, useState, type CSSProperties } from "react";
import { getHealth, listSpecs, type ProductSpec } from "./api";

export function App() {
  const [health, setHealth] = useState<string>("checking…");
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then((h) => setHealth(`${h.service} v${h.version} — ${h.status}`))
      .catch((e) => setErr(String(e)));
    listSpecs()
      .then(setSpecs)
      .catch(() => {/* sidecar/DB may not be up yet in scaffold */});
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ color: "#1B3A5C" }}>COQ_GEN <span style={{ color: "#A67C2E" }}>— Phase 0</span></h1>
      <p>Core API: <strong>{err ? `unreachable (${err})` : health}</strong></p>

      <h2 style={{ color: "#1B3A5C" }}>Product specifications</h2>
      {specs.length === 0 ? (
        <p style={{ color: "#475569" }}>No specs loaded (start the sidecar + apply the schema/seed).</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>{["Code", "Ver", "Cat", "Dominance", "Title"].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #1B3A5C", padding: 6 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {specs.map((s) => (
              <tr key={`${s.spec_code}-${s.version}`}>
                <td style={td}>{s.spec_code}</td>
                <td style={td}>{s.version}</td>
                <td style={td}>{s.category}</td>
                <td style={td}>{s.dominance ?? "—"}</td>
                <td style={td}>{s.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const td: CSSProperties = { borderBottom: "1px solid #E3EAF3", padding: 6 };
