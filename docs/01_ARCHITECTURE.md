# 01 — Software Architecture

This document describes COQ_GEN using the **C4 model** (Context → Container → Component) plus the
key runtime flows. The guiding principles are stated first because they explain every later
decision.

## 1.1 Architectural principles

1. **Deterministic core, agentic edge.** Anything that touches a released certificate (numbering,
   register, template rendering, PDF bytes, audit) is deterministic and testable. The *judgement*
   (extraction, semantic matching, narrative) is delegated to Letta agents and is always
   **human‑confirmable** before it can influence a release.
2. **Provenance is not optional.** No value enters the master parameter store without a pointer to
   its source (eCOA id → page → bounding box → confidence → asserting model). The COQ cannot render
   a line that lacks provenance.
3. **The database is the contract.** The relational schema ([03](03_DATA_MODEL.md)) is the single
   source of truth; agents and UI are clients of it. Agent output is *staged*, reviewed, then
   *committed* — agents never write directly to release tables.
4. **Local‑first, KVM4‑augmented.** The desktop app and its local FastAPI sidecar own the data,
   the DB connection, the OCR, and the COQ compiler. KVM4 (Letta) provides intelligence and
   cross‑batch memory. A KVM4 outage degrades the app to "manual assist", never to "data loss".
5. **Templates are user data.** COQ layouts are uploaded HTML (Variation F family), validated
   against a mandatory‑token contract, version‑controlled, and rendered in a sandbox.

## 1.2 C4 Level 1 — System context

```mermaid
graph TB
    analyst["QC Analyst / QC Manager<br/>(Blagoj, Jovana)"]
    subgraph desktop["COQ_GEN Desktop Application (controlled workstation)"]
        app["Tauri + React UI<br/>+ local FastAPI sidecar"]
    end
    labs["Outsourced Labs<br/>LT-083 UKIM · LT-005 IJZ · others<br/>(PDF eCOAs, multi-lingual)"]
    kvm4["KVM4 — Letta Server<br/>stateful agent fleet + memory"]
    db[("Centralised QC Database<br/>PostgreSQL")]
    qp["EU Importer Qualified Person<br/>(downstream Annex-16 certification)"]

    analyst -->|drops PDFs, reviews, signs| app
    labs -.->|eCOA PDFs| analyst
    app -->|OCR'd + parsed payloads| kvm4
    kvm4 -->|extraction, matching, narrative| app
    app <-->|read/write QC records| db
    app -->|issued COQ PDF + data pack| qp
```

## 1.3 C4 Level 2 — Containers

```mermaid
graph TB
    subgraph workstation["Controlled QC Workstation"]
        ui["UI Shell<br/><b>Tauri (Rust) + React/TS</b><br/>ingest · batch console · COQ builder · register viewer"]
        core["Core API (local sidecar)<br/><b>FastAPI / Python</b><br/>orchestration · jobs · DB access · COQ compiler"]
        ocr["Ingestion Engine<br/><b>OCR + Visual Understanding</b><br/>docTR / PaddleOCR · layout · table extraction"]
        vec["Local Vector Index<br/><b>pgvector</b> (in PostgreSQL)"]
    end

    subgraph kvm4["KVM4 (network)"]
        gw["Agent Gateway<br/><b>FastAPI facade</b><br/>auth · routing · schema validation · retries"]
        letta["Letta Server<br/>stateful agents + archival memory"]
    end

    db[("PostgreSQL + pgvector<br/>batches · lineage · eCOA · params · COQ · register · audit")]
    obj[("Object store / encrypted FS<br/>source PDFs · rendered COQ PDFs")]

    ui <-->|local IPC / HTTP 127.0.0.1| core
    core --> ocr
    core <--> db
    core --> obj
    core --> vec
    core -->|HTTPS + mTLS| gw
    gw --> letta
    letta -.->|tool calls back for retrieval| gw
```

**Container responsibilities**

| Container | Responsibility | Tech |
|-----------|----------------|------|
| **UI Shell** | All human interaction; native file handling; renders staged extractions for review; drives the COQ builder; never talks to KVM4 directly. | Tauri (Rust) + React + TypeScript |
| **Core API (sidecar)** | The brain on the workstation: job queue, pipeline state machine, DB access, COQ compiler, audit writer, Letta gateway client. Runs as a localhost‑only FastAPI process started by the Tauri shell. | FastAPI, SQLAlchemy, Alembic, Celery/RQ or asyncio jobs |
| **Ingestion Engine** | OCR, layout analysis, table extraction, PDF text extraction, image preprocessing. Pure functions, no agent dependency. | docTR / PaddleOCR / Tesseract; pdfplumber/PyMuPDF; OpenCV |
| **Agent Gateway** | The *only* surface the app uses to reach Letta. Validates request/response schemas, enforces auth, applies retries/timeouts/circuit‑breaking, normalises agent JSON. | FastAPI on KVM4 |
| **Letta Server** | Hosts the stateful agent fleet + per‑agent archival memory; performs RAAG. | Letta on KVM4 |
| **PostgreSQL + pgvector** | Centralised relational store **and** the embedding index. One database = one transactional truth + simple backup/restore for CSV. | PostgreSQL 16 + pgvector |
| **Object store** | Immutable source PDFs and rendered COQ PDFs, content‑addressed (SHA‑256). | Encrypted local FS or MinIO/S3 |

## 1.4 C4 Level 3 — Core API components

```mermaid
graph LR
    subgraph core["Core API (FastAPI sidecar)"]
        intake["Intake & Dedup<br/>hash, store, register doc"]
        ocrsvc["OCR/Visual Service<br/>scanned vs digital routing"]
        parse["Parser + Chunker<br/>layout-aware, table-aware"]
        embed["Embedder + Indexer<br/>text-embedding-3-small → pgvector"]
        orch["Pipeline Orchestrator<br/>state machine + Letta gateway client"]
        stage["Staging + Review API<br/>human-in-the-loop confirm"]
        master["Master Parameter Resolver<br/>per-batch single source of truth"]
        lineage["Lineage Service<br/>cultivation→production→packaging"]
        coq["COQ Compiler<br/>template engine + compliance guard"]
        num["Numbering + Register<br/>transactional allocator"]
        pdf["PDF Renderer<br/>HTML→PDF, locked"]
        audit["Audit + e-Sign Ledger<br/>ALCOA+"]
    end
    intake --> ocrsvc --> parse --> embed --> orch --> stage --> master
    lineage --> master
    master --> coq --> num --> pdf
    orch -. writes provenance .-> audit
    stage -. records who/what/when .-> audit
    coq -. compliance events .-> audit
    num -. issuance event .-> audit
```

## 1.5 Primary runtime flow — eCOA → COQ (sequence)

```mermaid
sequenceDiagram
    autonumber
    actor A as QC Analyst
    participant UI as UI Shell
    participant C as Core API
    participant O as OCR/Parse/Embed
    participant G as Agent Gateway (KVM4)
    participant L as Letta Agents
    participant DB as PostgreSQL

    A->>UI: Drop eCOA PDFs for a batch
    UI->>C: POST /ingest (files, batch hint)
    C->>C: SHA-256 dedup, store PDF, create document row
    C->>O: OCR (if scanned) + layout + table extraction
    O-->>C: text blocks + tables + bboxes + confidence
    C->>O: chunk + embed → pgvector
    C->>G: POST /agents/coa-ingestion/classify (payload + retrieval ctx)
    G->>L: route to CoA Ingestion Agent (stateful)
    L-->>G: doc_type, source_lab, batch_ids, dates
    G->>L: route to Parameter Extraction Agent
    L-->>G: parameter rows (name, method, limit, result, units, provenance)
    G->>L: route to CoQ Assembly Agent (semantic match to spec)
    L-->>G: matched_lines, unmatched_specs, compliance_summary, confidence
    G-->>C: normalised JSON (validated vs schema)
    C->>DB: write STAGED extraction + provenance
    C-->>UI: present staged results for review
    A->>UI: correct/confirm low-confidence lines
    UI->>C: POST /staging/commit
    C->>DB: commit to master parameter store (single source of truth)
    C->>G: feedback corrections (write-back to agent memory)
    A->>UI: Generate COQ (choose template)
    UI->>C: POST /coq/compile (batch, template_id)
    C->>C: compliance guard (mandatory tokens + forbidden "EU GMP")
    C->>DB: allocate next CoQ-PP-YYYY-NNNN (transactional)
    C->>C: render HTML→PDF, hash, lock
    C->>DB: write Certificate Issuance Register row + audit
    C-->>UI: COQ PDF + register entry
    A->>UI: apply dual e-signature (Blagoj + Jovana)
```

## 1.6 Pipeline state machine

Each ingested document and each batch‑COQ moves through explicit states; the orchestrator is the
only writer of these transitions and every transition is audited.

```mermaid
stateDiagram-v2
    [*] --> Received
    Received --> OCR_Done: scanned→OCR / digital→text
    OCR_Done --> Parsed
    Parsed --> Indexed
    Indexed --> Extracted: agent extraction
    Extracted --> Staged
    Staged --> NeedsReview: any line conf < threshold
    NeedsReview --> Staged: analyst corrects
    Staged --> Committed: analyst confirms
    Committed --> [*]

    state COQ {
        [*] --> Draft
        Draft --> ComplianceCheck
        ComplianceCheck --> Blocked: forbidden token / missing field
        Blocked --> Draft
        ComplianceCheck --> Numbered: allocate CoQ-PP-YYYY-NNNN
        Numbered --> Rendered
        Rendered --> Signed: dual e-signature
        Signed --> Issued: register write + lock
        Issued --> [*]
    }
```

## 1.7 Failure & degradation modes

| Failure | Behaviour |
|---------|-----------|
| KVM4 / Letta unreachable | Ingestion still runs (OCR/parse/embed local). Extraction queues; analyst can also enter parameters manually. COQ engine fully functional on already‑committed data. |
| Agent returns malformed JSON | Gateway rejects against JSON Schema; Core API marks line `extraction_failed`, never stages garbage; retried with stricter prompt; falls back to manual. |
| OCR low confidence | Page flagged; routed to `warehouse_quarantine_ocr_agent` (gpt‑4o) as a second pass; analyst sees the original page region side‑by‑side. |
| Numbering race (two COQs at once) | `SELECT … FOR UPDATE` on the per‑year counter row inside the issuing transaction guarantees monotonicity. |
| Template renders a forbidden string | Compliance guard *blocks* issuance, shows the offending token + location, requires owner override (recorded). |
| DB connection lost mid‑issue | Issuance is a single transaction (allocate number + register row + lock); it either fully commits or fully rolls back — no orphan numbers. |

## 1.8 Deployment topology

```mermaid
graph TB
    subgraph ws["Controlled QC Workstation (Win/macOS/Linux)"]
        tauri["COQ_GEN desktop (signed, auto-update)"]
        side["FastAPI sidecar (127.0.0.1 only)"]
        local["Local OCR models + cache"]
    end
    subgraph net["Purely Plant network / VPN"]
        pg[("PostgreSQL 16 + pgvector<br/>centralised, backed up")]
        store[("Encrypted object store")]
    end
    subgraph kvm4["KVM4 host"]
        gw["Agent Gateway (FastAPI, TLS/mTLS)"]
        letta["Letta server + Postgres (agent state)"]
    end
    tauri --- side
    side --- local
    side -->|TLS| pg
    side -->|TLS| store
    side -->|HTTPS + mTLS + token| gw --> letta
```

- The desktop app is **code‑signed** and **auto‑updates**; the sidecar binds to `127.0.0.1`
  only and is never exposed on the network.
- The **centralised** PostgreSQL satisfies the brief's "centralised relational database"
  requirement — all workstations share one transactional truth, enabling multi‑analyst use and a
  single backup/restore boundary for Computer System Validation.
- KVM4 holds only *agent* state (memory, learned synonyms); the *records of truth* live in the
  Purely Plant database, keeping the regulated data inside the controlled boundary.

See [02 — Technology Stack](02_TECH_STACK.md) for the concrete component choices and rationale.
