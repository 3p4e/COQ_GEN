/* ============================================================================
   Template + Document-Generator API. Templates are LIVE; the Document Generator
   preview/issue endpoints are not built yet — typed mocks here, one-line swap to
   live when the engine ships them (POST /{coq|icoa}/preview + /issue).
   ============================================================================ */
import type { DocumentTemplate, TemplateUpload, DocType } from "../types/models";

const BASE = "http://127.0.0.1:8765";
const TOKEN =
  (import.meta as { env?: Record<string, string> }).env?.VITE_COQGEN_TOKEN ?? "dev-session-token";
const authHeaders = { "X-COQGEN-Token": TOKEN };

/* ── Templates — LIVE ───────────────────────────────────────────────────────*/
export async function listTemplates(includeSuperseded = false): Promise<DocumentTemplate[]> {
  const qs = includeSuperseded ? "?include_superseded=true" : "";
  const r = await fetch(`${BASE}/templates${qs}`, { headers: authHeaders });
  if (!r.ok) throw new Error(`/templates → ${r.status}`);
  return r.json();
}
export async function listTemplateVersions(docType: DocType): Promise<DocumentTemplate[]> {
  const r = await fetch(`${BASE}/templates/${docType}`, { headers: authHeaders });
  if (!r.ok) throw new Error(`/templates/${docType} → ${r.status}`);
  return r.json();
}
/** Upload a new version; backend auto-supersedes the prior active for that doc_type. */
export async function uploadTemplate(body: TemplateUpload): Promise<DocumentTemplate> {
  const r = await fetch(`${BASE}/templates`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST /templates → ${r.status}`);
  return r.json();
}

/* ── Document Generator — PROVISIONAL (preview/issue not built yet) ──────────*/
export interface GenPreview { document_code_preview: string; html: string; }
export interface GenIssued { certificate_number: string; }

/** @provisional swap to POST /coq/preview | /icoa/preview when shipped. */
export function previewDocument(docType: DocType, _batchNo: string): Promise<GenPreview> {
  const series = docType === "icoa" ? "iCoA-PP-2026-NNNN" : "CoQ-PP-2026-NNNN";
  return new Promise((res) => setTimeout(() => res({ document_code_preview: series, html: "" }), 200));
}
/** @provisional swap to POST /coq/issue | /icoa/issue when shipped. */
export function issueDocument(docType: DocType, _batchNo: string, _templateVersion: string): Promise<GenIssued> {
  const n = docType === "icoa" ? "iCoA-PP-2026-0030" : "CoQ-PP-2026-0010";
  return new Promise((res) => setTimeout(() => res({ certificate_number: n }), 1200));
}
