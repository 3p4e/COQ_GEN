# 09 — SOP Alignment & Traceability

This document traces the design to the two governing SOPs supplied by the owner:

- **QCSOP 010** — *SOP for Specifications* (development, content, coding §6.6, revision, Master
  Specification Register).
- **QCSOP 012 v3** — *SOP for Certificate of Analysis & Certificate of Quality — Issuance and
  Management* (iCoA / eCoA / CoQ lifecycle, numbering, register, signatories, OOS, retention).

Rules previously inferred from agent memory are now anchored to the SOP clauses. Where the SOP
**corrected** an earlier assumption, the change made to the design is listed.

## 9.1 Headline corrections the SOPs forced

| # | What changed | Source clause | Where fixed |
|---|--------------|---------------|-------------|
| C1 | **The CoQ is NOT an EU‑GMP Annex 16 batch‑release certificate.** It is a QC‑internal aggregation of all iCoA + eCoA results vs the spec, used as **one input** to the QP's separate release decision. | QCSOP 012 v3 §3 (definitions): *"The CoQ is not itself a batch release certificate as defined by EU GMP Annex 16 … not defined by EU GMP."* | docs 00/06/08 reworded; "EU‑GMP‑compliant COQ" → "complete spec‑conformance input for QP release" |
| C2 | **Three certificate types, not one.** The CoQ consolidates **internal iCoA** and **external eCoA** results — the system must ingest internal CoAs too, not only external. | QCSOP 012 v3 §3, §6.4 | `ecoa_document.cert_type` (iCoA\|eCoA) + `origin`; master store accepts both |
| C3 | **Numbering is per certificate type, per calendar year**, strictly monotonic; gaps are ALCOA+ data‑integrity events. | QCSOP 012 v3 §6.9.1 | `coq_sequence` → `cert_sequence(cert_type, year)`; smoke T1/T1b |
| C4 | **The register tracks iCoA, eCoA and CoQ** (eCoA gets `eCoA-PP-YYYY-NNNN` + a register row on receipt, status Pending Review→Accepted). | QCSOP 012 v3 §6.3.2, §6.9 | `register_entry` generalised (nullable `coq_id` + `ecoa_document_id`, `UNIQUE(cert_type,year,seq_no)`) |
| C5 | **Issuing a CoQ for a batch with an open OOS is a reportable deviation** (QASOP 010). | QCSOP 012 v3 §6.6, §6.11 | Compliance Guard rule added (docs 06 §6.4) |
| C6 | **Each strain gets its own spec number** even if parameters are identical. | QCSOP 010 §6.6 | `product_spec.strain`; note in docs 03 |
| C7 | **Master Specification Register** with Active/Superseded/Withdrawn lifecycle. | QCSOP 010 §6.10 | `product_spec.status` |

## 9.2 What the SOPs CONFIRMED (design already correct)

| Design feature | Confirming clause |
|----------------|-------------------|
| Per‑parameter source mapping: param, acceptance, result, units, **testing lab (internal/external)**, **source cert ref + issue date**, conformance | QCSOP 012 v3 §6.4.1 (CoQ aggregated results table + source certificate list) |
| **Conformance determined by Purely Plant, not copied from the eCoA** | QCSOP 012 v3 §6.3.2: *"The conformance determination shall be made by Purely Plant, not taken from the eCoA."* |
| Transactional, monotonic numbering allocated at **final approval** (DB authoritative, not agent memory) | QCSOP 012 v3 §5 (Head of QC "assigns final certificate numbers on final approval") + §6.9.1 |
| **Two CoQ sign‑offs, no Qualified Person as signatory** (Prepared by Senior QC Analyst/Head of Lab; Reviewed & Approved by Head of QC) | QCSOP 012 v3 §5, §6.4.3 |
| eCoAs retained in **original language**; working translations don't replace originals | QCSOP 012 v3 §6.7 |
| OOS certificates carry explicit "Out of Specification — [parameter(s)]" + highlight | QCSOP 012 v3 §6.6 |
| Spec categories **IMG / IPM / FP / IMB**; code `QCSP-[CAT]-[NNN] v.[VV]` | QCSOP 010 §6.6 |
| Controlled storage, role‑based access, audit trail (Annex 11 §9), retention, change control | QCSOP 012 v3 §5.x; QCSOP 010 §6.10 |

## 9.3 Certificate lifecycle (as governed by QCSOP 012 v3)

```mermaid
graph TB
    subgraph internal["Internal testing"]
        ica["iCoA drafted by Analyst<br/>(Analysed by)"] --> icaR["Reviewed & Approved by Head of QC"]
        icaR --> icaReg["Register: iCoA-PP-YYYY-NNNN"]
    end
    subgraph external["External testing"]
        eca["eCoA received via secure channel"] --> ecaReg["Register: eCoA-PP-YYYY-NNNN<br/>status Pending Review"]
        ecaReg --> ecaChk["Review vs Annex A03 checklist<br/>conformance determined by PP"]
        ecaChk -->|accepted| ecaOK["status Accepted"]
        ecaChk -->|rejected| ecaNo["Voided -> corrected eCoA"]
    end
    icaReg --> gate{"All iCoAs approved<br/>+ all eCoAs accepted?"}
    ecaOK --> gate
    gate -->|yes, no open OOS| coq["CoQ compiled (Annex A02)<br/>Prepared by Senior QC Analyst"]
    gate -->|open OOS| dev["Deviation (QASOP 010) — block"]
    coq --> coqR["Reviewed & Approved by Head of QC<br/>assign CoQ-PP-YYYY-NNNN"]
    coqR --> qp["Input to QP batch release<br/>(separate Annex 16 procedure)"]
```

## 9.4 The EU‑GMP vs MK‑GMP wording — RESOLVED (owner ruling)

The supplied **product specifications** (QCSP‑IMB‑001 v.01, QCSP‑FP‑001 v.01, both 26 May 2026)
print **"EU GMP Certified Facility"** in the footer (manufacturer *Purely Plant DOOEL, Petrovec,
N. Macedonia*). The `VariationF` agent's locked rule (set 5 Jun 2026, i.e. *after* these specs)
says flower CoQ/CoA/**Spec** must print **"MK GMP Certified Facility"** and **flag any "EU GMP"
string for owner confirmation**.

**Owner ruling (confirmed): "MK GMP" is authoritative.** Flower CoQ/CoA/Spec documents must print
**"MK GMP Certified Facility" (MALMED, North Macedonia)** and the Compliance Guard **hard‑blocks**
the literal string `EU GMP` on flower documents (audited owner override only). The two uploaded
specs' footers are treated as the error this rule corrects and should be re‑issued under change
control. This ruling is encoded as data in `controlled_vocabulary`
(`forbidden_string`/`gmp_wording` rows seeded in `db/schema.sql`) and verified by smoke test **T6**,
so the policy is enforced by configuration, not code.

## 9.5 Open items to confirm with QC

1. **GMP facility wording** (EU vs MK) — §9.4.
2. **iCoA/eCoA seed counters** — current per‑type, per‑year sequence values for 2025/2026 (CoQ is
   known: 2025→0032, 2026→0009; iCoA/eCoA counters needed to seed `cert_sequence`).
3. **Spec applicability** — confirm whether `QCSP-IMB-001`/`QCSP-FP-001` are strain‑agnostic
   master specs or whether per‑strain spec numbers exist (QCSOP 010 §6.6 implies per‑strain).
4. **Active spec version** — the agent referenced `QCSP-IMB-001 v02`; the supplied document is
   `v.01` (26 May 2026, superseding legacy `PP-QC-SPEC-IB-001 v02`). Confirm the authoritative version.
5. **Annex A02/A03/A05 templates** — obtain the controlled CoQ/checklist/register templates to
   bind the renderer and the upload‑validation token set exactly.
