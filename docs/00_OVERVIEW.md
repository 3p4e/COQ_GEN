# 00 — Overview, Scope & Regulatory Context

## 0.1 Vision

COQ_GEN replaces a manual, error‑prone, transcription‑heavy QC workflow — in which a Purely
Plant analyst reads several outsourced‑laboratory PDF certificates and hand‑copies results into
a Certificate of Quality — with a **controlled, traceable, agent‑assisted pipeline**. The human
remains the decision maker (GMP requires it), but the machine does the reading, the extraction,
the cross‑lingual matching, the arithmetic of compliance, the numbering, and the document
assembly. Every machine assertion is traceable back to a pixel region of a source PDF.

The product is a **desktop application** (not a web app) for three reasons:

1. **Data residency / GxP control** — regulated QC records and source certificates stay on a
   controlled workstation and a controlled database, not in an uncontrolled browser cache.
2. **Local file handling** — analysts work with folders of scanned PDFs; native file dialogs,
   drag‑and‑drop, and a local sidecar OCR engine are first‑class.
3. **Determinism + offline tolerance** — the COQ compiler, template renderer and register must
   produce byte‑stable output and keep working during transient network loss to KVM4.

## 0.2 Scope

**In scope**
- Ingestion of external eCOAs (scanned + digital PDFs) from multiple, multilingual labs.
- OCR + visual document understanding; context‑aware parse → chunk → embed → index.
- Extraction of the full parameter record set (see §0.5).
- Centralised relational store keyed by **Batch Number** + **Packaging Batch Number**.
- Lineage: **Cultivation Batch → Production Batch → Packaging Batch**.
- A per‑batch **master parameter database** = single source of truth for COQ compilation.
- COQ generation from **user‑uploaded HTML templates**, with mandatory release fields enforced.
- Source mapping: every COQ result line → its source eCOA document code + date.
- Save / export (PDF) / issuance + coding history (Certificate Issuance Register).

**Out of scope (explicitly, for v1)**
- The labs' own LIMS; we consume their issued PDFs, we do not integrate to their instruments.
- ERP / inventory management beyond the batch identifiers we need for lineage.
- The EU importer's Qualified Person Annex‑16 certification step (we *feed* it; we don't *do* it).
- Cultivation / production MES. We record the batch identifiers; we don't run the grow.

## 0.3 Regulatory context (why the design is shaped the way it is)

Purely Plant manufactures pharmaceutical cannabis intermediate bulk in **MALMED, Republic of
N. Macedonia**, and the site is **MK‑GMP certified**. Product is exported into the EU, where an
**importer's Qualified Person (QP)** performs batch certification under **EU GMP Annex 16**
before release to the EU market. The COQ produced by COQ_GEN is the **manufacturer's release
Certificate of Quality** that travels with the batch and supplies the QP with everything needed
to certify.

This produces three hard design constraints that recur in every document:

1. **Information completeness.** Per **QCSOP 012 v3**, the CoQ is a **QC‑internal aggregation**
   of all internal (**iCoA**) and external (**eCoA**) results for a batch against its approved
   specification — it is **not itself an EU‑GMP Annex 16 batch‑release certificate**; it is **one
   input** to the Qualified Person's separate release decision. "Complete" therefore means the CoQ
   carries everything the QP needs to evaluate conformance: product + batch identity, spec
   reference and version, every spec parameter with method/limit/result/verdict, the **testing
   laboratory (internal/external) and the source certificate reference + date** for each line,
   sampling/analysis dates, overall disposition (with explicit OOS statement if any), and the dual
   QC sign‑off. See [06 §6.3](06_COQ_GENERATION_ENGINE.md) and the SOP trace in
   [09](09_SOP_ALIGNMENT.md).
2. **Wording guardrail (the "never print EU GMP" rule).** Flower CoQ/CoA/Spec documents print
   **"MK GMP Certified Facility" (MALMED)** and must **never** contain the literal string
   `EU GMP`. The engine scans rendered output and *blocks* release if the forbidden string
   appears on a flower document, surfacing it for owner confirmation. (IMG technical specs have
   historically cited EU‑GMP *chapters* as an engineering basis — that is the only sanctioned
   exception, and it lives on IMG specs, not on flower CoQs.)
3. **Data integrity (ALCOA+).** Every record is Attributable, Legible, Contemporaneous,
   Original, Accurate — plus Complete, Consistent, Enduring, Available. This is what forces the
   audit trail, the e‑signature ledger, the immutable source mapping, and the
   computer‑system‑validation (CSV) plan in [08](08_SECURITY_DATA_INTEGRITY.md).

## 0.4 Governing internal procedures (encoded as system rules)

These already exist in the Letta agents' instructions and become **configuration + validation
rules** in COQ_GEN (never hard‑coded magic strings — see [03](03_DATA_MODEL.md) `controlled_vocabulary`):

| Procedure | Rule the system enforces |
|-----------|--------------------------|
| **QCSOP 012 v3** | COQ code = `CoQ-PP-[YYYY]-[NNNN]`; sequential, strictly monotonic, zero‑padded to 4; resets to `0001` on Jan 1. Counters live in the register; the next number is *allocated transactionally*. |
| **QCSOP 010** | Spec code = `QCSP-[CAT]-[NNN] v[VV]`; `CAT ∈ {IMG, IPM, FP, IMB}`. Active cannabis intermediate‑bulk spec: `QCSP-IMB-001 v02`. |
| **QCLB 020 / Annex A05** | Every issued COQ writes a Certificate Issuance Register row with the fixed field set (see [06 §6.6](06_COQ_GENERATION_ENGINE.md)). |
| **Signatories** | Exactly **two**, **no Qualified Person on the manufacturer COQ**: Blagoj Nikolov (QC Manager) + Jovana (Head of QC / QA). Configurable, but the *count = 2 / QP‑absent* rule is validated. |

## 0.5 The parameter record (what "extraction" must produce)

For **every** analytical line on **every** eCOA, the system extracts and stores:

- **Parameter name** (as printed, in the lab's language) + canonical parameter id (resolved via ontology).
- **Testing method** (e.g., USP <61>, Ph. Eur. 2.6.12, HPLC‑DAD, GC‑MS, ICP‑MS).
- **Acceptance criteria** (operator + value(s) + unit, e.g., `≤ 10^3 CFU/g`, `Absent / 1 g`).
- **Analytical result** (value, unit, qualifier such as `<LOQ`, `ND`, `Conforms`).
- **Issuing institution**: name, address, accreditation / credentials, lab code (`LT-083 UKIM`, `LT-005 IJZ`).
- **Document code** of the source eCOA (e.g., `eCoA-PP-YYYY-NNNN` or the lab's own report number).
- **Issuing / analysis / sampling dates**.
- **Provenance**: page number + bounding box + extraction confidence + the agent/model that asserted it.

Critically, **a single product specification may be satisfied by parameters issued by different
institutions** (microbiology from one lab, heavy metals from another, cannabinoid potency from a
third). The data model and the matcher are built around this heterogeneity from the start.

## 0.6 Glossary

| Term | Meaning |
|------|---------|
| **eCoA** | **External** Certificate of Analysis — a PDF issued by an **outsourced** testing laboratory (their format, ingested). |
| **iCoA (= CoA)** | **Internal** Certificate of Analysis — performed and issued **inside Purely Plant**, carries only PP's own parameter result(s), **never references another lab**. App‑generated; `iCoA-PP-YYYY-NNNN`. "CoA" and "iCoA" are the same document. |
| **COQ** | Certificate of Quality — compiled by this system; the **only** document that aggregates across sources, citing per parameter the issuing lab + eCoA code + date (or the iCoA). |
| **Spec** | Product specification (`QCSP-…`) listing required parameters + acceptance criteria. |
| **Master parameter store** | The reconciled, per‑batch single source of truth used to compile the COQ. |
| **Lineage** | The chain Cultivation Batch № → Production Batch № → Packaging Batch №. |
| **OOS** | Out‑of‑specification result. |
| **Register** | Certificate Issuance Register (QCLB 020 / Annex A05). |
| **Variation F** | Purely Plant's Navy & Gold regulated‑document visual identity / template family. |
| **RAAG** | **Retrieval‑Augmented Agentic Generation** — see §0.7. |

## 0.7 What "RAAG" means here

The brief calls for "advanced **RAAG** ingestion." We define RAAG as **Retrieval‑Augmented
Agentic Generation**: a superset of classic RAG in which the retrieval and generation steps are
driven by **stateful agents** (Letta), not a single stateless `retrieve → stuff → generate`
call. Concretely, RAAG in COQ_GEN means:

1. **Retrieval is agent‑directed and iterative.** The agent decides *what* to retrieve
   (this lab's synonym map, the active spec, prior corrections for this lab/parameter, similar
   historical batches) and *when it has enough* — using Letta's `archival_memory_search`,
   `semantic_search_files`, `grep_files`, and `conversation_search` tools.
2. **Generation is grounded and self‑correcting.** Extraction/matching outputs are validated
   against the spec and against learned lab patterns; low‑confidence lines are re‑queried.
3. **Memory persists across documents and time.** Each correction an analyst makes
   (e.g., "UKIM's `TAMC` == IJZ's `Вкупен број на аеробни микроорганизми` == canonical
   *Total Aerobic Microbial Count*") is written back to the agent's archival memory and to the
   shared parameter dictionary, so the system gets measurably better per lab over time.

RAAG is therefore the bridge between the deterministic ingestion pipeline (OCR + parse + embed)
and the deterministic COQ engine: the *judgement* layer in the middle is agentic and learns.
