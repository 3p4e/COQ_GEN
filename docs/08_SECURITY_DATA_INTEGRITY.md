# 08 — Security, Data Integrity & Computer System Validation

COQ_GEN produces GMP release records. It must therefore be built as a **GxP computerised system**:
secure, attributable, tamper‑evident, and validated. This document defines those controls.

## 8.1 Regulatory frame

| Framework | What it requires of us |
|-----------|------------------------|
| **EU GMP Annex 11** (computerised systems) | risk‑based validation, access control, audit trails, e‑signatures, data backup, change control, business continuity |
| **EU GMP Annex 16** (QP certification) | the COQ must carry the complete batch‑certification information set (we *supply* the QP) |
| **EU GMP Chapter 4** (documentation) | controlled, versioned, retrievable records; no destructive edits |
| **ALCOA+** (data integrity) | Attributable, Legible, Contemporaneous, Original, Accurate + Complete, Consistent, Enduring, Available |
| **GAMP 5** | categorise components by risk; validate proportionately (the custom COQ logic gets the most rigour) |
| **21 CFR Part 11** (if any US‑facing use) | equivalent e‑signature/audit controls — our design already meets it |

## 8.2 ALCOA+ — how each principle is met

| Principle | Control in COQ_GEN |
|-----------|--------------------|
| **Attributable** | every record carries actor (`app_user`) + agent/model that asserted it; all writes audited |
| **Legible** | structured DB + human‑readable PDF/A; raw OCR text retained alongside parsed values |
| **Contemporaneous** | UTC server timestamps at the moment of action; no client‑settable times |
| **Original** | source PDFs stored immutably, content‑addressed (SHA‑256); raw extraction text kept |
| **Accurate** | confidence gates + mandatory human confirmation + bbox provenance + golden tests |
| **Complete** | staged→committed→superseded (never delete); gaps shown explicitly as `not_tested` |
| **Consistent** | one centralised PostgreSQL truth; transactional issuance; FK integrity |
| **Enduring** | append‑only hash‑chained audit; PDF/A archival; backups + retention policy |
| **Available** | centralised DB + register UI + export; restore tested in DR drill |

## 8.3 Audit trail (tamper‑evident)

- `audit_event` is **append‑only** and **hash‑chained**:
  `payload_hash = SHA256(prev_hash ‖ canonical_json(payload))`. Deleting or back‑dating any event
  breaks the chain and is detectable by a periodic verifier job.
- Events captured: ingest, OCR escalation, stage, correct, commit, master selection, numbering
  allocation, compliance pass/block/override, render, signature, issue, void, export, config
  change, agent‑memory write‑back.
- The audit trail is **reviewable** in‑app (Annex 11 requires audit‑trail review as part of batch
  release) and exportable for inspectors.

## 8.4 Access control & authentication

- Named user accounts (no shared logins) with roles: `qc_analyst`, `qc_manager`, `head_of_qc`,
  `admin`. Least privilege; the DB uses **separate roles** for the app (DML) vs migrations (DDL).
- The sidecar binds `127.0.0.1` only, gated by a per‑session token from the Tauri shell.
- KVM4 access: **mTLS + bearer token**; the gateway is the sole egress; route‑map allow‑list
  ([05 §5.1a]) means only suitable agents are reachable.
- Secrets (DB creds, KVM4 token) in the OS keychain (Tauri Stronghold), never in plaintext config.

## 8.5 Electronic signatures (Annex 11 §14 / Part 11)

- Each signature binds to the exact record bytes (`record_sha256`) and records signer identity,
  role, **meaning**, method, timestamp.
- COQ rule: **two** signatures, **no Qualified Person** on the manufacturer COQ (Blagoj Nikolov —
  QC Manager — "Prepared & Approved"; Jovana — Head of QC — "Reviewed"); the count/role rule is
  validated by the Compliance Guard.
- Re‑authentication at the moment of signing; signatures are non‑repudiable and cannot be copied
  between records (each is bound to its record hash).

## 8.6 Data residency & confidentiality

- Records of truth (batches, eCOA data, COQs, register, audit) live **inside the Purely Plant
  boundary** (centralised PostgreSQL); only *agent* state lives on KVM4.
- **Data minimisation to KVM4:** the gateway sends chunks + structured candidates needed for
  reasoning, not whole document dumps, and is the single audited egress point.
- Encryption: TLS in transit everywhere; encrypted object store + encrypted DB volumes at rest;
  encrypted local model cache.

## 8.7 The "EU GMP vs MK GMP" guardrail (compliance‑critical)

This is both a **compliance** and a **data‑integrity** control, restated here because it is
load‑bearing:

- Flower CoQ/CoA/Spec print **"MK GMP Certified Facility" (MALMED, N. Macedonia)** and must
  **never** contain the literal `EU GMP`.
- Enforced twice: on the **bound data** before numbering, and on the **rendered PDF text** after
  rendering. A hit **blocks** issuance and requires an explicit, audited owner override.
- "EU‑GMP‑compliant COQ" = the certificate's **information completeness** for the EU importer's QP,
  not a printed EU‑GMP claim. The only sanctioned `EU GMP` references live on IMG technical specs
  (engineering basis), never on flower COQs.

## 8.8 Computer System Validation (CSV) deliverables

| Document | Content |
|----------|---------|
| **Validation Plan** | scope, risk approach (GAMP 5), roles, acceptance |
| **URS** | user requirements (this brief, decomposed and numbered) |
| **FS / DS** | functional + design specs (this doc set, traced) |
| **Traceability Matrix** | URS ↔ FS ↔ DS ↔ test cases (every requirement tested) |
| **IQ** | installed components, versions, config baselines (reproducible build) |
| **OQ** | each function works to spec: ingestion, matching, guard, numbering, signing, export |
| **PQ** | works on **real batches** in the user's hands (parallel‑run pilot, Phase 6) |
| **Audit‑trail review SOP** | how QC reviews the trail at release |
| **Backup/Restore + DR runbook** | tested restore; RPO/RTO |
| **Change Control SOP** | code *and* agent prompt/version changes |
| **Periodic Review** | scheduled re‑validation triggers |

## 8.9 Component risk categorisation (GAMP 5)

| Component | GAMP category | Rigour |
|-----------|---------------|--------|
| PostgreSQL, OS, Tauri, FastAPI | 1 (infrastructure) | qualify versions |
| OCR libs, WeasyPrint, pgvector | 3 (non‑configured COTS) | verify fit‑for‑purpose, pin versions |
| Letta agents + prompts | 4/5 (configured + bespoke) | validate behaviour on labelled corpus; change control |
| **Compliance Guard, numbering, master resolver, COQ compiler** | **5 (custom)** | **highest**: full unit/integration/golden tests + formal review |

## 8.10 Change control for agents (because they are stateful & probabilistic)

- All prompt/memory/version changes happen in a **staging Letta org** first, are tested against
  the labelled corpus, and are promoted via the same change‑control as code.
- Agent outputs are always **schema‑validated** and **human‑confirmed** before influencing a
  release; the deterministic guard is the final, testable arbiter — so agent drift can never alone
  produce a non‑compliant issued COQ.

## 8.11 Business continuity

- Centralised DB backups (point‑in‑time recovery); object‑store replication; tested restore.
- KVM4 outage → local‑first degradation ([01 §1.7]); queued agent‑memory write‑back replays on
  reconnect (DB is always the authority).
- Issued COQs are immutable PDF/A with embedded fonts — readable for the full record‑retention
  period independent of the application.
