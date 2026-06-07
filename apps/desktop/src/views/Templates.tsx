import { useEffect, useState, type CSSProperties } from "react";
import { UploadCloud, FileText, History, Check, Eye, X } from "lucide-react";
import { Badge, Button, Input } from "../components";
import { listTemplateVersions, uploadTemplate } from "../api/documents";
import type { DocumentTemplate, DocType } from "../types/models";

const DOC_TYPES: { id: DocType; label: string; note: string }[] = [
  { id: "icoa", label: "iCoA", note: "Internal Certificate of Analysis" },
  { id: "coq", label: "CoQ", note: "Certificate of Quality" },
  { id: "coa", label: "CoA", note: "Generic CoA layout" },
  { id: "spec", label: "Spec", note: "Specification sheet" },
];

const card: CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: 20 };
const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

export function Templates() {
  const [docType, setDocType] = useState<DocType>("icoa");
  const [versions, setVersions] = useState<DocumentTemplate[] | null>(null);
  const [error, setError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const [file, setFile] = useState<{ name: string; html: string } | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = (dt: DocType) => {
    setVersions(null); setError(false);
    listTemplateVersions(dt).then(setVersions).catch(() => { setError(true); setVersions([]); });
  };
  useEffect(() => { load(docType); }, [docType]);

  const active = (versions ?? []).find((v) => v.is_active);
  const superseded = (versions ?? []).filter((v) => !v.is_active);

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result ?? "");
      setFile({ name: f.name, html });
      if (!name) setName(f.name.replace(/\.html?$/i, ""));
    };
    reader.readAsText(f);
  };

  const submit = () => {
    if (!file || !name || !version) return;
    setBusy(true); setOkMsg(null);
    uploadTemplate({ doc_type: docType, name, version, html: file.html, doc_class: `flower_${docType}`, render_engine: "weasyprint" })
      .then((t) => { setOkMsg(`${t.name} v${t.version} is now the active ${docType} template.`); setFile(null); setName(""); setVersion(""); load(docType); })
      .catch(() => setOkMsg("Upload failed — is the sidecar running?"))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>Document Templates</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 3 }}>Manage the .html templates the app renders documents from. Uploading a new version supersedes the prior active one; issued documents keep their original version.</p>
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {DOC_TYPES.map((d) => (
          <button key={d.id} onClick={() => setDocType(d.id)} style={tab(docType === d.id)}>
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontSize: 10, opacity: 0.75 }}>{d.note}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={card}>
            <SectionLabel>Active Template</SectionLabel>
            {versions == null ? (
              <Muted>Loading…</Muted>
            ) : !active ? (
              <Muted>{error ? "Core API unreachable." : `No ${docType} template uploaded yet. Upload one to activate it.`}</Muted>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: "var(--color-accent-tint)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-accent-deep)", flexShrink: 0 }}><FileText size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{active.name}</span>
                    <Badge status="issued" size="sm" dot={false} label={`v${active.version}`} />
                    <Badge status="conforms" size="sm" label="Active" />
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: "var(--text-quaternary)", marginTop: 2 }}>{active.doc_class} · {active.render_engine}</div>
                </div>
                <Button variant="secondary" size="sm" icon={<Eye size={13} />} onClick={() => setPreviewName(active.name)}>Preview</Button>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showHistory ? 12 : 0 }}>
              <SectionLabel>{`Version History (${superseded.length})`}</SectionLabel>
              <button onClick={() => setShowHistory((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-brand)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-sans)" }}>
                <History size={13} /> {showHistory ? "Hide" : "Show"}
              </button>
            </div>
            {showHistory && (superseded.length === 0 ? (
              <Muted>No superseded versions.</Muted>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {superseded.map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.name}</span>
                      <span style={{ ...mono, fontSize: 11, color: "var(--text-quaternary)" }}>v{v.version}</span>
                    </div>
                    <Badge status="superseded" size="sm" label="Superseded" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <SectionLabel>{`Upload New ${docType.toUpperCase()} Version`}</SectionLabel>
          <label
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 12px", border: "2px dashed var(--border-strong)", borderRadius: "var(--radius-md)", cursor: "pointer", marginBottom: 12, background: file ? "var(--color-accent-tint)" : "transparent" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
          >
            <UploadCloud size={22} style={{ color: "var(--color-brand)" }} />
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>{file ? file.name : "Drop or click to choose an .html template"}</span>
            <input type="file" accept=".html,text/html" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input label="Template Name" value={name} onChange={setName} placeholder={`Purely Plant ${docType.toUpperCase()}`} />
            <Input label="Version" value={version} onChange={setVersion} placeholder="01" prefix="v" />
            <Button variant="primary" fullWidth disabled={!file || !name || !version || busy} icon={busy ? undefined : <Check size={14} />} onClick={submit}>
              {busy ? "Uploading…" : "Upload & Activate"}
            </Button>
            {okMsg && <div style={{ fontSize: 11, color: "var(--status-pass)", lineHeight: 1.5 }}>{okMsg}</div>}
            <div style={{ fontSize: 10, color: "var(--text-quaternary)", lineHeight: 1.5 }}>
              Auto-supersedes the current active {docType} template. For <strong>icoa</strong>, engineering wires the mandatory-token validation when the final HTML is registered.
            </div>
          </div>
        </div>
      </div>

      {previewName && (
        <div onClick={() => setPreviewName(null)} style={{ position: "fixed", inset: 0, background: "var(--surface-overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface-card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-xl)", width: 720, maxWidth: "90vw", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Template Preview — {previewName}</span>
              <button onClick={() => setPreviewName(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13, textAlign: "center" }}>Rendered preview binds to the stored template HTML (server returns it on the version endpoint). Drop in a sample to see it here.</div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-quaternary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--text-quaternary)", padding: "6px 0" }}>{children}</div>;
}

const tab = (active: boolean): CSSProperties => ({
  display: "flex", flexDirection: "column", gap: 1, padding: "8px 16px", borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, textAlign: "left",
  background: active ? "var(--color-brand)" : "var(--surface-card)", color: active ? "var(--text-inverse)" : "var(--text-tertiary)",
  border: `1px solid ${active ? "var(--color-brand)" : "var(--border-strong)"}`,
});
