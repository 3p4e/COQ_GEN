// Thin client for the localhost Core API sidecar. The Tauri shell injects the
// per-session token; in browser dev it falls back to the dev token.
const BASE = "http://127.0.0.1:8765";
const TOKEN = (import.meta as { env?: Record<string, string> }).env?.VITE_COQGEN_TOKEN
  ?? "dev-session-token";

export async function getHealth(): Promise<{ status: string; service: string; version: string }> {
  const r = await fetch(`${BASE}/health`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export type ProductSpec = {
  spec_code: string;
  version: string;
  category: string;
  title: string;
  dominance?: string | null;
  status: string;
};

export async function listSpecs(): Promise<ProductSpec[]> {
  const r = await fetch(`${BASE}/specs`, { headers: { "X-COQGEN-Token": TOKEN } });
  if (!r.ok) throw new Error(`specs ${r.status}`);
  return r.json();
}
