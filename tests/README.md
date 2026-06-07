# Tests

COQ_GEN is currently design + foundational artifacts, but the artifacts that *exist* are
executable and verified. This harness proves them.

## What runs today

```bash
# Prereqs: PostgreSQL 16 + pgvector running locally
sudo apt-get install -y postgresql-16 postgresql-16-pgvector
sudo pg_ctlcluster 16 main start

# Run everything (schema apply + data-layer smoke + OpenAPI validation)
bash tests/run.sh
# optional: pip install openapi-spec-validator   # enables formal 3.1 validation
```

| File | Verifies |
|------|----------|
| `run.sh` | Orchestrates all checks; exits non-zero on any failure |
| `smoke.sql` | Data-layer guarantees (below) — each check `RAISE`s on failure |
| `validate_openapi.py` | `api/gateway_openapi.yaml` is valid OpenAPI 3.1 with all `$ref`s resolving |

### Data-layer guarantees checked (`smoke.sql`)

| ID | Guarantee | Brief requirement |
|----|-----------|-------------------|
| T1 | Transactional monotonic numbering yields `CoQ-PP-2026-0010` and advances the counter | QCSOP 012 v3 numbering |
| T2 | Every *confirmed* master row carries source eCOA code + date + institution | "map every parameter result back to its source eCOA" |
| T3 | Cyrillic `Вкупен број на аеробни микроорганизми` resolves to canonical `TAMC` | heterogeneous multilingual labs |
| T4 | Only one *confirmed* master row per (batch, spec parameter) — `uq_master_confirmed` | single source of truth |
| T5 | Audit hash chain binds each event to the previous and verifies | ALCOA+ tamper-evidence |

**Last run: all green** — `db/schema.sql` applies clean (23 tables, pgvector column live),
T1–T5 PASS, OpenAPI structural + formal 3.1 validation PASS.

## Live KVM4 agent smoke test (manual, via Letta MCP)

The core intelligence was exercised against the **real deployed agents** with a synthetic
multi-lab, multi-lingual eCOA:

| Agent | Result |
|-------|--------|
| `CoA Ingestion Agent` (deepseek-v4-flash) | Correctly classified `cannabis_coa`, lab UKIM/LT-083, batches `PB-2026-0011` + `PK-2026-0021`, strain, all three dates. Autonomously ran `archival_memory_search` (live RAAG). |
| `Parameter Extraction Agent` (deepseek-v4-flash) | Extracted all 5 analytical lines to clean JSON with correct qualifiers (`<` for TYMC, presence/absence for *E. coli*). |
| `CoQ Assembly Agent` (deepseek-v4-pro) | Cross-lingual match: Cyrillic `Вкупен број…` → Total Aerobic Microbial Count (PASS), understood `отсутно`=absent; matched TYMC/Pb/Cd from the other lab; **correctly flagged Aflatoxins total as an unmatched gap**. Its archival memory returned the real register: `NEXT AVAILABLE: CoQ-PP-2026-0010` — matching the deterministic allocator in T1. |

### Findings (actionable)

1. **Agent memory blocks not provisioned.** `CoA Ingestion Agent` attempted to persist a learned
   extraction pattern to a `extraction_patterns` core-memory block that does not exist, and
   errored. Provision the per-agent memory blocks / archival synonym seeds described in
   `docs/05_LETTA_AGENT_INTEGRATION.md §5.5` before relying on the learning loop.
2. **Numbering authority confirmed.** The agent's remembered register and the DB allocator agree
   on `CoQ-PP-2026-0010`; keep the DB as the source of truth and write the final number *back* to
   agent memory after issue (as designed).
3. **Pre-existing MVP exists.** Agent memory references `PurelyPlant_DocPlatform.html` (a
   single-file HTML CoQ/CoA platform on KVM4) — this architecture is its productionization.

## Not yet testable (no code yet)

Ingestion/OCR, the Core API, the COQ compiler/renderer, and the UI are specified but not built.
The build order and their test gates (golden-file COQ regression, etc.) are in
`docs/07_ROADMAP.md`.
