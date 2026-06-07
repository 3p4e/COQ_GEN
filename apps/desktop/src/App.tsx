import { useEffect, useState } from "react";
import { AppShell, type ViewId, type BatchContext } from "./AppShell";
import { Dashboard } from "./views/Dashboard";
import { CertRegister } from "./views/CertRegister";
import { IngestionView } from "./views/IngestionView";
import { BatchRecord } from "./views/BatchRecord";
import { DocumentGenerator } from "./views/DocumentGenerator";
import { OOSView } from "./views/OOSView";
import { Laboratories } from "./views/Laboratories";
import { Templates } from "./views/Templates";
import { Placeholder } from "./views/Placeholder";
import { getHealth } from "./api";
import "./styles/global.css";

const ACTIVE_BATCH: BatchContext = { packaging_batch_no: "—", processing_batch_no: "—", status: "no batch selected" };

export function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [health, setHealth] = useState<"ok" | "down" | "checking">("checking");

  useEffect(() => { getHealth().then(() => setHealth("ok")).catch(() => setHealth("down")); }, []);

  return (
    <AppShell current={view} onNavigate={setView} batchContext={ACTIVE_BATCH}>
      {health === "down" && (
        <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: "var(--radius-md)", background: "var(--status-pending-bg)", border: "1px solid var(--status-pending-border)", color: "var(--status-pending)", fontSize: 12 }}>
          Core API sidecar unreachable — views show empty/loading states. Start it with <code style={{ fontFamily: "var(--font-mono)" }}>make api</code>.
        </div>
      )}

      {view === "dashboard" && <Dashboard onNavigate={setView} />}
      {view === "ingestion" && <IngestionView />}
      {view === "batches" && <BatchRecord onNavigate={setView} />}
      {view === "gen" && <DocumentGenerator initial="coq" />}
      {view === "register" && <CertRegister />}
      {view === "oos" && <OOSView />}
      {view === "labs" && <Laboratories />}
      {view === "templates" && <Templates />}
      {view === "parameters" && <Placeholder title="Parameter Database" note="Specification master per product/grade with default_source (internal/external/not_performed). Wires to GET /specs and GET /parameters (both live)." />}
      {view === "settings" && <Placeholder title="Settings" note="Sidecar token, Letta gateway, user roles. (Templates moved to their own view.)" />}
    </AppShell>
  );
}
