# 02 — Technology Stack & Rationale

Every choice below is justified against the brief's constraints: a **desktop** app, **OCR +
visual understanding**, a **RAG/RAAG** pipeline, **Letta agents via FastAPI on KVM4**, a
**centralised relational DB**, and **GMP‑grade traceability**. Where a popular alternative was
rejected, the reason is given.

## 2.1 Stack at a glance

| Layer | Choice | Why (short) |
|-------|--------|-------------|
| Desktop shell | **Tauri 2 (Rust)** | Tiny, signed, auto‑updating native shell; secure IPC; bundles a Python sidecar cleanly. |
| UI | **React 18 + TypeScript + Vite** | Mature, typed, great table/PDF‑viewer ecosystem for review UX. |
| UI components | **shadcn/ui + TailwindCSS + TanStack Table/Query** | Dense data grids (parameter review) + server‑state caching. |
| In‑app PDF view | **PDF.js** | Render source eCOA pages with bbox overlays for provenance review. |
| Local backend | **Python 3.12 + FastAPI + Uvicorn** | Same language as the AI/OCR ecosystem; async; OpenAPI‑native. |
| ORM / migrations | **SQLAlchemy 2.0 + Alembic** | Typed models; versioned, auditable schema migrations (CSV requirement). |
| Validation / contracts | **Pydantic v2** | One schema definition → API validation + agent‑output validation + codegen. |
| Jobs | **Asyncio task queue (in‑proc) → Celery/RQ if scaled** | Local‑first; no broker needed for single‑workstation v1. |
| Database | **PostgreSQL 16** | Centralised, transactional, JSONB for semi‑structured eCOA, mature backup/restore. |
| Vector index | **pgvector** (in the same PostgreSQL) | One datastore = one truth + one backup boundary; avoids a second system to validate. |
| OCR | **docTR** (primary) + **PaddleOCR** (CJK/Cyrillic strength) + **Tesseract** (fallback) | Multilingual incl. Cyrillic; layout‑aware; all run locally. |
| Visual understanding | **PyMuPDF + pdfplumber** (digital) · **table‑transformer / img2table** (scanned tables) | Detects digital vs scanned; extracts tables with cell geometry. |
| Embeddings | **text-embedding-3-small (1536‑d)** | **Matches the embedding model already configured on every KVM4 agent** → vectors are interoperable with Letta archival memory. |
| AI orchestration | **Letta** (stateful agents on KVM4) behind a **FastAPI gateway**; client via the **Letta MCP** tools | Stateful, memory‑bearing agents already exist for this exact domain. |
| HTML→PDF | **WeasyPrint** (primary) / **Playwright‑Chromium** (pixel‑exact Variation F) | Deterministic, locked PDF/A output from the uploaded HTML templates. |
| Templating | **Jinja2** within a sandboxed environment | Renders user HTML templates against the mandatory‑token contract. |
| e‑Signatures | **Application‑level signature ledger** + optional PKCS#7 PDF signing | Annex 11 §14 electronic signatures bound to records. |
| Packaging | **Tauri bundler** (msi/dmg/AppImage) + **PyInstaller** sidecar | Single signed installer; reproducible builds for validation. |
| Observability | **structlog + OpenTelemetry → local file + optional collector** | Tamper‑evident structured logs feed the audit trail. |
| Tests | **pytest + Playwright + golden‑file COQ regression** | Byte‑stable COQ output is a release gate. |

## 2.2 Frontend: why Tauri + React (not Electron, not PySide)

- **Tauri vs Electron.** Tauri ships a ~3–10 MB binary (vs Electron's ~150 MB), uses the OS
  webview, has a hardened security model (explicit IPC allow‑list, no Node in the renderer), and
  has first‑class **code signing + auto‑update** — all of which matter for a *validated* desktop
  app distributed to controlled workstations. The Rust core is also a clean place to spawn,
  supervise and health‑check the Python sidecar.
- **Why a webview UI at all (vs native Qt/PySide).** The review experience is fundamentally a
  rich data application: side‑by‑side PDF + extracted‑parameter grids, diff/confirm flows, an
  HTML template gallery, live COQ preview. The React + Tailwind + TanStack ecosystem builds this
  far faster and more maintainably than Qt, and the COQ templates *are HTML* — so an HTML‑capable
  renderer in the UI gives a true WYSIWYG COQ preview for free.
- **TypeScript end‑to‑end.** Pydantic models are exported to TypeScript types (via
  `datamodel-code-generator` / OpenAPI codegen) so the UI and the sidecar can never silently
  drift on the parameter/COQ contracts.

## 2.3 Backend: why a local FastAPI sidecar

- **One language for AI + OCR + web.** FastAPI keeps the OCR engine, the embedder, the Letta
  client, and the COQ compiler in one Python process — no cross‑language marshalling for the
  data‑heavy paths.
- **Localhost‑only.** The sidecar binds `127.0.0.1` with a per‑session token issued by the Tauri
  shell, so the regulated brain is never network‑reachable.
- **OpenAPI‑native.** The same FastAPI app emits the OpenAPI the UI consumes and mirrors the
  gateway contract in [api/gateway_openapi.yaml](../api/gateway_openapi.yaml).

## 2.4 Database: why one PostgreSQL with pgvector

The brief demands a **centralised relational database**. PostgreSQL gives us:

- **Relational integrity** for the batch/lineage/parameter/COQ/register tables (foreign keys,
  `FOR UPDATE` locking for the numbering allocator, transactional issuance).
- **JSONB** columns for the long tail of lab‑specific fields we don't want to over‑normalise.
- **pgvector** so embeddings live *next to* the records they describe — retrieval can join
  semantic similarity with hard filters (`WHERE batch_id = … AND parameter_category = …`), which
  pure vector DBs do poorly. One datastore also means **one backup/restore + one validation
  boundary**, a real CSV advantage over Postgres + a separate vector store.

> Rejected: a standalone vector DB (Pinecone/Weaviate/Qdrant). It adds a second system to
> validate, secure and back up, and we lose transactional joins between vectors and QC records.
> pgvector at our document volumes (hundreds–thousands of eCOAs) is more than sufficient.

**Supabase note.** A Supabase MCP is available in this environment; Supabase *is* PostgreSQL +
pgvector and can host the centralised DB if a managed option is preferred — the schema in
[db/schema.sql](../db/schema.sql) applies unchanged. For strict on‑prem data residency, a
self‑hosted PostgreSQL inside the Purely Plant network is the default recommendation.

## 2.5 Ingestion stack: OCR + visual understanding

- **Digital‑vs‑scanned routing first.** `PyMuPDF` checks for an embedded text layer. Digital
  PDFs go straight to `pdfplumber`/PyMuPDF text + table extraction (fast, lossless). Scanned PDFs
  go to OCR.
- **OCR engines, ranked.** `docTR` (deep‑learning detection+recognition, layout aware) as
  primary; **`PaddleOCR`** specifically because Purely Plant receives **Cyrillic** Macedonian
  certificates (`LT-005 IJZ`) and PaddleOCR's multilingual models handle Cyrillic well;
  `Tesseract` as a deterministic fallback. The `warehouse_quarantine_ocr_agent` (gpt‑4o, vision)
  is the escalation path for genuinely degraded scans.
- **Tables.** Lab results are tables. `table-transformer` (Microsoft) / `img2table` recover cell
  geometry so a result value stays bound to its row's parameter name and its column's
  acceptance‑criteria — preserving the structure the matcher depends on.
- **Provenance.** Every extracted token keeps its **page + bounding box**, which the UI overlays
  on the PDF.js view so an analyst can verify any value with one click.

## 2.6 AI orchestration: Letta + FastAPI gateway

- **Letta** provides exactly what the brief asks for: *stateful* agents with persistent
  **archival memory** (per‑lab synonym maps, prior corrections, numbering register state) and
  built‑in retrieval tools (`archival_memory_search`, `semantic_search_files`, `grep_files`,
  `conversation_search`) — the substrate for **RAAG**.
- The app talks to Letta **only** through a **FastAPI gateway on KVM4** (the brief's requirement),
  which: authenticates, validates request/response JSON Schemas, routes to the correct named
  agent, applies timeouts/retries/circuit‑breaking, and normalises agent output. During
  development and ops, the **Letta MCP** tool surface (`letta_agent_advanced`,
  `letta_memory_unified`, `letta_source_manager`, `letta_tool_manager`) is used to provision,
  inspect and message agents.
- **Models** mirror what's deployed: `deepseek-v4-pro` for reasoning‑heavy agents (assembly,
  compliance, spec advisor), `deepseek-v4-flash` for fast extraction/classification, `gpt-4o`
  for vision OCR. See [05](05_LETTA_AGENT_INTEGRATION.md).

## 2.7 COQ rendering: why WeasyPrint (+ optional Playwright)

- COQ layouts are **user‑uploaded HTML** in the Variation F (Navy & Gold) family. `Jinja2`
  binds the master‑parameter data into the template; `WeasyPrint` renders deterministic **PDF/A**
  with embedded fonts (a long‑term archiving + reproducibility win for golden‑file tests).
- For pixel‑exact fidelity to the existing `CoQ_Template_v02_VariationF.html` (green verdict
  band, gold rules, zebra tables), a **Playwright‑Chromium** renderer is available as an
  alternate backend selectable per template, since those templates were authored against a
  Chromium print engine.

## 2.8 Cross‑cutting

| Concern | Choice |
|---------|--------|
| Secrets | OS keychain via Tauri Stronghold; KVM4 token + DB creds never in plaintext config. |
| Config | `pydantic-settings`, environment‑scoped (dev/val/prod), no business constants hard‑coded. |
| Migrations | Alembic, forward‑only in validated environments, each migration reviewed + tested. |
| Time | All timestamps UTC in storage; localised only for display; matches Letta agents (UTC). |
| IDs | UUIDv7 for surrogate keys (time‑ordered, index‑friendly); human codes (`CoQ-PP-…`) separate. |
| Licensing | All chosen libs are permissive (MIT/BSD/Apache) **except WeasyPrint/Tesseract**; confirm GPL/MPL posture for distribution, or select Playwright‑only rendering if needed. |

The data those components move is defined next in [03 — Data Model](03_DATA_MODEL.md).
