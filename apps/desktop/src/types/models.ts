// Friendly, stable type aliases over the auto-generated OpenAPI types.
// Generated source: api.d.ts (do not edit). Regenerate both with `make gen-types`
// (or `bash scripts/gen_types.sh`) after any backend schema change.
//
// UI code should import from here, e.g.:
//   import type { ProductSpec, BatchSummary } from "./types/models";
import type { components } from "./api";

type S = components["schemas"];

export type Health = S["Health"];
export type DbHealth = S["DbHealth"];
export type ProductSpec = S["ProductSpec"];
export type SpecParameter = S["SpecParameter"];
export type SpecGrade = S["SpecGrade"];
export type IngestAccepted = S["IngestAccepted"];

// Phase 1.5 view bindings
export type DashboardSummary = S["DashboardSummary"];
export type DocumentRef = S["DocumentRef"];
export type BatchSummary = S["BatchSummary"];
export type Batch = S["Batch"];
export type LineageRef = S["LineageRef"];
export type MasterParameterLine = S["MasterParameterLine"];
export type RegisterEntry = S["RegisterEntry"];
export type OOSItem = S["OOSItem"];
export type DocumentTemplate = S["DocumentTemplate"];
export type TemplateUpload = S["TemplateUpload"];
export type LabInstitution = S["LabInstitution"];
export type ParameterDictionaryEntry = S["ParameterDictionaryEntry"];

// Canonical string vocabularies — the single source of truth for views/status.ts
// (answers the design lane's open ask #2). Kept in sync with the backend enums.
export type Verdict = "pass" | "fail" | "pending" | "not_tested";
export type CertType = "iCoA" | "eCoA" | "CoQ";
export type DocType = "icoa" | "coq" | "coa" | "spec";
export type ParameterSource = "internal" | "external" | "not_performed";
// production_batch.status
export type BatchStatus = "in_progress" | "testing" | "released" | "rejected";
// OOSItem.status
export type OOSStatus = "open" | "under_investigation" | "closed";
// coq.status (issuance lifecycle)
export type CoqStatus = "draft" | "numbered" | "rendered" | "signed" | "issued" | "voided";
// register_entry.status / ecoa_document.register_status
export type RegisterStatus =
  | "pending_review" | "accepted" | "rejected"   // source certs (iCoA/eCoA)
  | "active" | "superseded" | "voided";          // CoQ entries
// document_template.status
export type TemplateStatus = "active" | "superseded" | "draft";
