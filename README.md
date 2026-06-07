# COQ_GEN — Automated eCOA → EU‑GMP Certificate of Quality Engine

> Desktop application for **Purely Plant GmbH** quality control: automated ingestion of
> external Certificates of Analysis (**eCOA**) from heterogeneous, multi‑lingual outsourced
> laboratories, and the controlled generation of release **Certificates of Quality (COQ)**
> whose content satisfies the EU‑GMP batch‑certification information set.

This repository contains the **technical architecture and the development roadmap** for the
COQ_GEN desktop application. It is a design‑first repository: every document below is written
to be directly executable as an engineering plan, grounded in the *actual* Letta agent fleet
and the *actual* Purely Plant business rules already deployed on **KVM4**.

---

## 1. What this system does (one paragraph)

A QC analyst drops one or more outsourced‑laboratory PDF certificates (scanned or digital)
into the desktop app. The app runs an OCR + visual‑understanding pass, performs context‑aware
parsing/chunking/embedding/indexing, and hands the structured payload to a fleet of **stateful
Letta AI agents** (hosted behind FastAPI on KVM4) that classify the document, extract every
parameter (name, method, acceptance criteria, result, units, issuing institution, document
code, dates), and match those parameters — *semantically, across languages* — to the active
product specification. The results are persisted in a centralised relational database keyed by
**Batch Number** and **Packaging Batch Number**, with full **cultivation → production →
packaging** lineage. When the batch's parameter set is complete, the **COQ Generation Engine**
compiles a release certificate from a user‑supplied **HTML template**, maps every result back
to its **source eCOA document code + date**, assigns the next monotonic `CoQ-PP-YYYY-NNNN`
number, writes the Certificate Issuance Register entry, and exports a locked PDF.

## 2. Document index

| # | Document | What it covers |
|---|----------|----------------|
| 00 | [docs/00_OVERVIEW.md](docs/00_OVERVIEW.md) | Vision, scope, regulatory context, glossary, **RAAG** definition |
| 01 | [docs/01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md) | C4 architecture, component decomposition, deployment, diagrams |
| 02 | [docs/02_TECH_STACK.md](docs/02_TECH_STACK.md) | Frontend / backend / database / AI‑orchestration stack + rationale |
| 03 | [docs/03_DATA_MODEL.md](docs/03_DATA_MODEL.md) | ERD, batch lineage, single‑source‑of‑truth parameter store, traceability |
| 04 | [docs/04_INGESTION_RAG_PIPELINE.md](docs/04_INGESTION_RAG_PIPELINE.md) | OCR + visual understanding, parse/chunk/embed/index, agentic RAAG |
| 05 | [docs/05_LETTA_AGENT_INTEGRATION.md](docs/05_LETTA_AGENT_INTEGRATION.md) | The KVM4 agent fleet, FastAPI gateway, orchestration contracts |
| 06 | [docs/06_COQ_GENERATION_ENGINE.md](docs/06_COQ_GENERATION_ENGINE.md) | Templating, GMP compliance guardrails, numbering, register, export |
| 07 | [docs/07_ROADMAP.md](docs/07_ROADMAP.md) | Phased implementation plan, milestones, staffing, risks |
| 08 | [docs/08_SECURITY_DATA_INTEGRITY.md](docs/08_SECURITY_DATA_INTEGRITY.md) | GMP Annex 11 / GxP, ALCOA+ data integrity, audit trail, e‑signatures |
| 09 | [docs/09_SOP_ALIGNMENT.md](docs/09_SOP_ALIGNMENT.md) | Traceability to **QCSOP 010** & **QCSOP 012 v3** — confirmations + corrections |
| 10 | [docs/10_PHYTOCERT_COMPARISON.md](docs/10_PHYTOCERT_COMPARISON.md) | In-depth comparison vs the **PhytoCert** design/UX prototype + adoption decision |
| 11 | [docs/11_DESIGN_AGENT_HANDSHAKE.md](docs/11_DESIGN_AGENT_HANDSHAKE.md) | **Design ⇄ Engineering agent handshake** (interface control doc) — collaboration contract |

Foundational, ready‑to‑build artifacts live alongside the docs:

| Path | Purpose |
|------|---------|
| [db/schema.sql](db/schema.sql) | PostgreSQL DDL for the full data model (batches, lineage, eCOA, parameters, COQ, register, audit) |
| [api/gateway_openapi.yaml](api/gateway_openapi.yaml) | OpenAPI contract for the FastAPI agent gateway on KVM4 |
| [templates/coq/README.md](templates/coq/README.md) | HTML template contract + mandatory release‑information token set |
| [tests/](tests/) | Executable harness — `bash tests/run.sh` applies the schema, runs data‑layer smoke checks, validates the OpenAPI. **All green.** |

> **Verified, not just designed.** `db/schema.sql` applies cleanly to PostgreSQL 16 + pgvector
> (23 tables); the numbering allocator, source‑mapping, cross‑lingual synonym resolution, the
> single‑source‑of‑truth release guard, and the audit hash‑chain all pass automated checks; the
> OpenAPI contract validates as 3.1; and the **live KVM4 agents** were smoke‑tested end‑to‑end
> (classify → extract → cross‑lingual spec‑match, with live RAAG memory). See [tests/README.md](tests/README.md).

## 3. Proposed repository structure (target state)

```
COQ_GEN/
├── apps/
│   └── desktop/                 # Tauri shell + React/TypeScript UI
│       ├── src/                 # UI: ingest, batch console, COQ builder, register
│       └── src-tauri/           # Rust shell, secure IPC, auto‑update, file dialogs
├── services/
│   ├── core_api/                # Local FastAPI: orchestration, DB, jobs (runs as sidecar)
│   │   ├── ingestion/           # OCR + visual understanding + parse/chunk/embed
│   │   ├── orchestration/       # Letta gateway client + pipeline state machine
│   │   ├── coq/                 # COQ compiler, template engine, PDF export
│   │   ├── lineage/             # batch lineage + master parameter resolver
│   │   └── audit/               # ALCOA+ audit trail, e‑signature ledger
│   └── gateway/                 # FastAPI reverse facade in front of Letta on KVM4
├── packages/
│   ├── schemas/                 # Pydantic + TypeScript shared contracts (codegen)
│   └── parameter_dictionary/    # canonical parameter ontology + lab synonym maps
├── db/                          # SQL DDL + Alembic migrations
├── api/                         # OpenAPI specs
├── templates/                   # user‑uploaded HTML COQ/CoA templates (Variation F)
├── docs/                        # this design set
└── tests/                       # unit, integration, golden‑file COQ regression
```

## 4. The KVM4 reality this design targets

This is **not** greenfield AI. A domain‑specific Letta agent fleet is already deployed and is
the backbone of the orchestration layer. **COQ_GEN reuses these existing agents through the
FastAPI gateway and creates no new agents unless a real capability gap is proven — and only
*suitable* agents are wired in.** Of the 42 agents on KVM4, the relevant subset is below;
unrelated agents (e.g. `stock_trading_advisor`, `trend_detector`, `ars_*`, `equipment_manuals_agent`)
are deliberately excluded from the gateway route map. See the full suitability matrix in
[docs/05 §5.1a](docs/05_LETTA_AGENT_INTEGRATION.md):

| Agent | Model | Role in the pipeline |
|-------|-------|----------------------|
| `CoA Ingestion Agent` | deepseek‑v4‑flash | Document type detection, OCR coordination, classification, metadata |
| `Parameter Extraction Agent` | deepseek‑v4‑flash | Structured extraction of parameter rows |
| `Compliance Analysis Agent` | deepseek‑v4‑pro | Per‑parameter pass/fail vs spec, OOS detection |
| `CoQ Assembly Agent` | deepseek‑v4‑pro | Semantic spec matching, numbering, register entry, narrative |
| `Specification Advisor Agent` | deepseek‑v4‑pro | Spec selection / version advice |
| `Report Generation Agent` | deepseek‑v4‑pro | Narrative + report composition |
| `Search Assistant Agent` | deepseek‑v4‑flash | Cross‑document semantic retrieval |
| `ecoa-qc-agent` | deepseek‑v4‑pro | eCOA QC / sanity checks |
| `warehouse_quarantine_ocr_agent` | gpt‑4o | OCR specialist for low‑quality scans |
| `VariationF` | gpt‑4o | Keeper of the **Variation F (Navy & Gold)** document design system + locked rules |

> **Compliance note carried throughout this design:** Purely Plant's *locked* rule is that
> flower CoQ/CoA/Spec documents print **"MK GMP Certified Facility" (MALMED, Republic of
> N. Macedonia)** and **never** the literal string "EU GMP". "EU‑GMP‑compliant COQ" therefore
> means *the certificate carries the complete information set an EU importer's Qualified Person
> needs for Annex‑16 batch certification* — not that the document makes an EU‑GMP claim. The
> engine enforces this as a hard guardrail (see [docs/06](docs/06_COQ_GENERATION_ENGINE.md)).

## 5. Status

Design complete; **Phase 0 (foundations) scaffolded and running.** Next:
**Phase 1 (ingestion)** → **Phase 2 (orchestration)** → **Phase 3 (COQ engine)** →
**Phase 4 (validation/CSV)** — see [docs/07_ROADMAP.md](docs/07_ROADMAP.md).

### Phase 0 — what's built and verified

| Component | Path | State |
|-----------|------|-------|
| Core API sidecar (FastAPI, localhost) | `services/core_api/` | **runs**: `/health`, `/healthz/db`, `/healthz/gateway`, `/specs`, `/ingest` (stub); token auth |
| Letta gateway (FastAPI, KVM4) | `services/gateway/` | **runs**: health + allow-listed `agents/{name}/invoke` (suitable agents only) |
| Shared contracts | `packages/schemas/` | Pydantic v2 → TS codegen source |
| Alembic baseline | `db/migrations/` | `alembic upgrade head` applies `db/schema.sql` (25 tables) |
| Desktop shell | `apps/desktop/` | Tauri 2 + React/TS; spawns the sidecar; type-checks + `vite build` in CI |
| CI | `.github/workflows/ci.yml` | postgres+pgvector service: SQL smoke, alembic, OpenAPI, pytest, ruff, UI build |

### Quickstart (local dev)

```bash
make install                 # venv + deps + editable packages
make setup                   # postgres role/db + alembic baseline + real spec fixtures
make api                     # Core API on http://127.0.0.1:8765
# in another shell:
curl -s localhost:8765/health
curl -s -H "X-COQGEN-Token: dev-session-token" localhost:8765/specs
make test                    # python unit tests
make test-sql                # SQL schema+smoke+OpenAPI checks
cd apps/desktop && npm install && npm run tauri dev   # desktop shell (needs Rust + webview deps)
```
