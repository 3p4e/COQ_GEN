/* ============================================================================
   Status / verdict → Badge mapping. Backend statuses are open strings; map the
   known ones and fall back gracefully. Single place to keep SOP vocabulary.
   ============================================================================ */
import type { BadgeStatus } from "../components";

/** MasterParameterLine.verdict: pass | fail | pending | not_tested */
export function verdictBadge(verdict: string): BadgeStatus {
  switch (verdict) {
    case "pass": return "conforms";
    case "fail": return "oos";
    case "not_tested": return "na";
    default: return "pending";
  }
}

/** RegisterEntry.status (QCSOP 012 §6.12 lifecycle). */
export function registerBadge(status: string): BadgeStatus {
  switch (status) {
    case "issued": return "issued";
    case "accepted": return "accepted";
    case "pending_review": return "pending-review";
    case "rejected": return "rejected";
    case "superseded": return "superseded";
    case "voided": return "voided";
    case "destroyed": return "destroyed";
    default: return "draft";
  }
}

/** BatchSummary.status → coarse QC badge. */
export function batchBadge(status: string): BadgeStatus {
  switch (status) {
    case "conforms": case "released": return "conforms";
    case "oos": return "oos";
    case "issued": return "issued";
    case "under_review": case "review": return "review";
    default: return "pending";
  }
}

/** DocumentRef.cert_type → tone by type. */
export function certTypeBadge(cert: string): BadgeStatus {
  switch (cert) {
    case "CoQ": return "issued";
    case "iCoA": return "review";
    default: return "accepted"; // eCoA
  }
}

export function fmtDate(d?: string | null): string {
  return d ?? "—";
}
