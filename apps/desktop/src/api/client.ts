/* ============================================================================
   COQ_GEN Core API client (Contract C, docs/11 §7).
   Base http://127.0.0.1:8765 · header X-COQGEN-Token (Tauri injects the real
   per-session token; browser dev falls back to dev-session-token).
   All shapes import from ../types/models (generated via `make gen-types`).
   ============================================================================ */
import type {
  Health, ProductSpec, DashboardSummary, BatchSummary, Batch,
  MasterParameterLine, RegisterEntry, OOSItem, LabInstitution,
  ParameterDictionaryEntry, IngestAccepted,
} from "../types/models";

const BASE = "http://127.0.0.1:8765";
const TOKEN =
  (import.meta as { env?: Record<string, string> }).env?.VITE_COQGEN_TOKEN ?? "dev-session-token";
const authHeaders = { "X-COQGEN-Token": TOKEN };

async function apiGet<T>(path: string, auth = true): Promise<T> {
  const r = await fetch(`${BASE}${path}`, auth ? { headers: authHeaders } : undefined);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

/* ── Reads (LIVE) ───────────────────────────────────────────────────────────*/
export const getHealth = (): Promise<Health> => apiGet<Health>("/health", false);
export const listSpecs = (): Promise<ProductSpec[]> => apiGet<ProductSpec[]>("/specs");
export const getSpec = (code: string, version: string): Promise<ProductSpec> => apiGet<ProductSpec>(`/specs/${code}/${version}`);
export const listParameters = (): Promise<ParameterDictionaryEntry[]> => apiGet<ParameterDictionaryEntry[]>("/parameters");
export const getDashboard = (): Promise<DashboardSummary> => apiGet<DashboardSummary>("/dashboard/summary");
export const listBatches = (): Promise<BatchSummary[]> => apiGet<BatchSummary[]>("/batches");
export const getBatch = (no: string): Promise<Batch> => apiGet<Batch>(`/batches/${encodeURIComponent(no)}`);
export const getMasterParameters = (no: string): Promise<MasterParameterLine[]> => apiGet<MasterParameterLine[]>(`/batches/${encodeURIComponent(no)}/master-parameters`);
export const listRegister = (): Promise<RegisterEntry[]> => apiGet<RegisterEntry[]>("/register");
export const listOos = (): Promise<OOSItem[]> => apiGet<OOSItem[]>("/oos");
export const listLabs = (): Promise<LabInstitution[]> => apiGet<LabInstitution[]>("/labs");

/* ── Mutations ──────────────────────────────────────────────────────────────*/
export const ingest = (filenames: string[], batchHint?: string): Promise<IngestAccepted> =>
  apiPost<IngestAccepted>("/ingest", { filenames, batch_hint: batchHint ?? null });
