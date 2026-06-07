# 11 — Design ⇄ Engineering Agent Handshake (Interface Control Document)

> **To:** the "Claude Design" agent that built the **PhytoCert Design System** & `phytocert_app`.
> **From:** the COQ_GEN engineering agent (backend / data / compliance / AI-orchestration).
> **Purpose:** get you up to speed on what's been built and decided, and define exactly how we
> collaborate from here — you on UI/UX/design-system, me on the engine — without stepping on each
> other. **Short answer: yes, we can absolutely coordinate this way. This document is the contract.**

---

## 1. The collaboration model

We work in **one repository** (`3p4e/coq_gen`) with **strict ownership lanes** and a small set of
**shared contract files** that are the only coupling between us. Coordination is asynchronous,
through the repo (branches + PRs) and through the contracts below; the **owner is the router**
between our two sessions. Optional shared long-term memory: the **Open Brain MCP** (both sessions
can read/write project decisions there).

| Lane | Owner | Paths |
|------|-------|-------|
| **UI / design system** | **You (Design)** | `apps/desktop/**` (except generated types), `packages/ui/**` if we add one, design tokens, components, views, certificate **look** (Variation F skin), specimens, accessibility |
| **Engine / domain / compliance** | **Me (Eng)** | `services/**`, `db/**`, `packages/schemas/**`, `tests/**`, `.github/**`, COQ logic, numbering, Letta integration |
| **Shared contracts (change = notify the other)** | **Both** | `packages/schemas/**` (I author Pydantic; you consume generated TS), `api/gateway_openapi.yaml`, the Core API OpenAPI, the **design-token variable names**, the GMP copywriting rules |

Rule of thumb: **you never hardcode domain values** (numbers, limits, verdicts, lab names, GMP
wording) — you render what the API/types give you. **I never hardcode UI** — I expose typed data
and let your components present it.

---

## 2. Where the project stands (so you're not starting cold)

- **Branch:** `claude/stoic-fermi-QHMxJ` → **draft PR #1**. Full design docs in `docs/00`–`docs/10`.
- **Phase 0 is built and runs:** a localhost **FastAPI Core API sidecar**, **PostgreSQL 16 + pgvector**,
  **Alembic** baseline, a **Tauri 2 + React/TS** shell that spawns the sidecar, a **Letta gateway**
  (suitable-agent allow-list), shared **Pydantic** contracts, **CI**, and **tests** (SQL T1–T6,
  pytest, OpenAPI) all green.
- **Live data already served:** the two real specs (QCSP-IMB-001 v.01, QCSP-FP-001 v.01) with 18
  parameters + 5 grade tiers each, via `GET /specs`.
- **Your PhytoCert work is adopted** as the UI/UX + design-system layer (see `docs/10`), rebuilt as
  real TSX wired to this backend. That's the whole point of this handshake.

Read for depth: `docs/01` (architecture), `docs/03` (data model), `docs/06` (COQ engine),
`docs/09` (SOP alignment), `docs/10` (the PhytoCert comparison + what we take from you).

---

## 3. Decisions you MUST honor (these override PhytoCert's spec-only assumptions)

PhytoCert was built only from the two product-spec HTMLs, so some of its domain assumptions are
superseded by the governing SOPs (QCSOP 010, QCSOP 012 v3) and owner rulings:

| Topic | PhytoCert had | Authoritative now |
|-------|---------------|-------------------|
| **Brand** | Forest green `#2D8F63` | **Variation F — Navy & Gold, EVERYWHERE** (app + certificates). Reskin tokens; see §5. |
| **GMP wording** | "EU GMP Certified Facility" + `badge-eu-gmp.svg` | **"MK GMP Certified Facility" (MALMED)**. The string **`EU GMP` is forbidden on flower docs** (hard-blocked). Drop the EU-GMP badge. |
| **CoQ numbering** | `COQ-FP-2026-047-A` | **`CoQ-PP-YYYY-NNNN`** (per-type, per-year, monotonic). Display only — backend assigns it. |
| **Cert types** | CoQ only | **iCoA (internal) + eCoA (external) + CoQ (aggregation)**. CoQ aggregates iCoA+eCoA vs spec. |
| **CoQ status** | — | CoQ is **not** an EU-GMP Annex 16 release cert; it's a QC-internal aggregation, **input to the QP**. |
| **Conformance** | from the eCoA | **determined by Purely Plant**, never copied from the eCoA. |
| **Signatories** | QP shown | **Two** signatories, **no Qualified Person** on the CoQ: *Prepared by* Senior QC Analyst/Head of Lab; *Reviewed & Approved by* Head of QC. |
| **Strains** | Sativa/Indica variety emphasis | **Strain-agnostic**: classify by **dominance (THC/CBD) + grade tier (I–V)**; strain is printed as **descriptive** info only. |
| **Labs** | Fictional (Berlin/Vienna/Amsterdam) | **Real: LT-083 UKIM** (Skopje, English) and **LT-005 IJZ** (Cyrillic/Macedonian). Lab list comes from the API. |
| **OOS** | — | Issuing a CoQ for a batch with an **open OOS** is a blocked deviation — the OOS/NCR view drives this. |

**Keep doing (brand-neutral craft we love):** IBM Plex Sans/Mono/Serif; Lucide icons; the status
semantics **Conforms / Out of Specification / Pending / Under Review**; GMP copywriting (never
"passed/failed", ISO dates, units always shown, no emoji); 4px grid; compact desktop density;
the three-zone shell; your component set and view structure.

---

## 4. What we adopt from you (so you know your work is used)

Design-system architecture (token files), the **component library** (Button, Badge, Input, Select,
Textarea, DataTable, DocumentCard), **Lucide** icon usage map, and the **view set / UX flows**:
Dashboard, eCoA Ingestion (drag-drop → OCR/agent pipeline → review/confirm), Batch Record
(parameter table with lab traceability), COQ Generator (template → preview → issue), Certificate
Register, OOS/NCR. Plus your **eCoA Review Checklist (Annex A03)** and certificate template
*structure*. We **rebuild these as TSX** (your prototype was `React.createElement` + globals) and
**reskin to Variation F**.

---

## 5. Contract A — Design tokens (your deliverable, our shared name space)

Target file: `apps/desktop/src/styles/tokens.css` (CSS custom properties). **Keep your variable
names** (`--color-*`, `--font-*`, `--space-*`, `--shadow-*`, `--radius-*`, `--ease-*`) so component
code is brand-independent; **swap the values to Variation F**:

```css
:root {
  /* Brand (was forest green) → Variation F navy + gold */
  --color-brand:        #1B3A5C;  /* navy — primary actions, active nav, brand */
  --color-brand-deep:   #0F2540;  /* navy-deep — sidebar, doc headers */
  --color-brand-mid:    #2C5282;  /* navy-mid */
  --color-brand-soft:   #3B6BA5;  /* navy-soft */
  --color-accent:       #A67C2E;  /* gold — accents, rules, official marks */
  --color-accent-bright:#C9A227;  /* gold-bright */
  --color-accent-deep:  #7A5C1E;  /* gold-deep */
  --color-accent-tint:  #FBF6E9;  /* gold-tint — highlight bg */
  /* Neutrals / surfaces */
  --surface-app:        #F8FAFC;  --surface-card: #FFFFFF;
  --zebra:              #F4F7FB;  --zebra-head:   #EEF3F9;
  --text-primary:       #0F172A;  --text-secondary:#1E293B;  --text-tertiary:#475569;  --text-quaternary:#8C9BB0;
  --border-subtle:      #E3EAF3;  --border-strong:#C9D4E3;
  /* Status (unchanged semantics) */
  --status-pass:   #15803D;  --status-pass-bg:  #ECFDF3;   /* Conforms */
  --status-fail:   #B91C1C;  --status-fail-bg:  #FEF2F2;   /* Out of Specification */
  --status-pending:#B45309;  --status-pending-bg:#FEF3C7;  /* Pending */
  --status-review: #6D28D9;  --status-review-bg:#F5F3FF;   /* Under Review (keep violet) */
  /* CoA-only accent */
  --stamp-bronze:  #8C6B3F;
  /* Type */
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --font-serif:'IBM Plex Serif', Georgia, serif; /* certificates */
}
```

(These hexes are the *locked* Variation F palette kept by the KVM4 `VariationF` agent.) Spacing,
shadows, radii, motion: keep your existing scales.

---

## 6. Contract B — Data shapes (typed, generated, not invented)

The single source of truth for cross-boundary shapes is **`packages/schemas`** (Pydantic v2). You
consume **generated TypeScript types** — do not invent payload shapes. Generation (we'll wire it
into the build): from the Core API OpenAPI via `openapi-typescript`, or `pydantic2ts` against
`coqgen_schemas`. Today's stable types include `Health`, `DbHealth`, `ProductSpec`, `SpecParameter`,
`SpecGrade`, `IngestAccepted` (see `packages/schemas/coqgen_schemas/__init__.py` and
`apps/desktop/src/api.ts` for the client pattern). When you need a new shape, request it; I add it
to Pydantic and the TS regenerates.

---

## 7. Contract C — API surface (what your views call)

- **Core API (local sidecar):** base `http://127.0.0.1:8765`, auth header **`X-COQGEN-Token`**
  (dev value `dev-session-token`; the Tauri shell injects the real per-session token). CSP already
  allows the UI → sidecar connection.
- **Letta agent gateway (KVM4):** only via the backend; you never call Letta directly. The contract
  is `api/gateway_openapi.yaml`.

**Live now:** `GET /health`, `GET /healthz/db`, `GET /healthz/gateway`,
`GET /specs`, `GET /specs/{code}/{version}`, `POST /ingest` (stub).

**Planned (I build the endpoint; you build the view against the typed shape / a typed mock):**

| View (yours) | Endpoint(s) I provide | Notes |
|--------------|-----------------------|-------|
| Dashboard | `GET /dashboard/summary`, `GET /batches` | KPIs + batch list |
| eCoA Ingestion | `POST /ingest`, `GET /documents/{id}`, `POST /staging/commit`, `GET /checklists/a03/{docId}` | drag-drop → pipeline → Annex A03 review/accept |
| Batch Record | `GET /batches/{batchNo}`, `GET /batches/{batchNo}/master-parameters` | param table + provenance (source eCoA code/date/lab) |
| COQ Generator | `GET /coq/templates`, `POST /coq/preview`, `POST /coq/issue` | preview → **compliance guard** → number → sign → export |
| Certificate Register | `GET /register` | iCoA/eCoA/CoQ rows |
| OOS / NCR | `GET /oos`, `POST /oos/{id}/resolve` | open-OOS blocks CoQ issuance |

Until an endpoint exists, build against a **typed mock** matching the generated type, behind a
small `api/` module, so swapping to live is a one-line change.

---

## 8. Definition of Done for a UI deliverable (so it integrates cleanly)

A view/component is "done" when it: (1) is **TSX** (not `React.createElement`); (2) imports the
**generated types** (no ad-hoc shapes); (3) styles **only via tokens** (no hardcoded hex/px for
brand colors); (4) contains **no forbidden domain strings** (e.g. `EU GMP` on flower docs) and uses
GMP copywriting; (5) renders backend data (or a typed mock) — **no invented numbers/limits/labs**;
(6) passes `tsc` + `vite build` (CI runs this) and lint; (7) is keyboard-navigable and works at
desktop density (13px base, ~36px rows). Certificates additionally use IBM Plex **Serif** and the
Variation F certificate skin.

---

## 9. Coordination protocol (how we avoid collisions)

1. **Branches:** you push UI work on `claude/design-*` branches touching `apps/desktop/**` only;
   I work on `claude/eng-*` for `services/**`, `db/**`, `packages/schemas/**`. PRs into the same
   integration branch / `main`.
2. **Contracts are sacred:** changing `packages/schemas`, the OpenAPI, or token *names* requires a
   note to the other agent in the PR description (the owner relays). Token *values* are yours.
3. **No edits across lanes** without a heads-up — keeps merges clean.
4. **Source of truth:** this repo + `docs/` + Open Brain memory. If a decision is ambiguous,
   escalate to the owner (don't guess on regulated behavior).
5. **Handoff format:** when you hand a view back, list which endpoints/types it expects; I wire or
   confirm them. When I add an endpoint, I post its type + an example payload for you to bind.

---

## 10. Your first work package (proposed — start when the owner says go)

UI porting is currently **paused** by owner direction, but here's the queued package so you can
prep:

1. **Tokens:** create `apps/desktop/src/styles/tokens.css` with the Variation F palette (§5);
   import IBM Plex + Lucide.
2. **Component library → TSX:** port Button, Badge (states: Conforms/OOS/Pending/Under Review/N-A),
   Input, Select, Textarea, DataTable, DocumentCard into `apps/desktop/src/components/`, typed.
3. **AppShell → TSX:** sidebar (Variation F navy) + header + nav (Dashboard, eCoA Ingestion, Batch
   Records, COQ Generator, Cert Register, OOS/NCR, Laboratories, Parameter DB, Settings); replace
   the QP persona block (no QP) with the two-signatory roles.
4. **Dashboard + Certificate Register** wired to `GET /specs` (live) + typed mocks for `/batches`
   and `/register` until I ship them.

**Acceptance:** `cd apps/desktop && npm run build` passes; app renders in the Tauri shell against
the running sidecar; no forbidden strings; tokens-only styling.

---

## 11. Quick start (run our stack)

```bash
make install          # venv + deps + editable packages
make setup            # postgres + alembic baseline + real spec fixtures
make api              # Core API → http://127.0.0.1:8765
cd apps/desktop && npm install && npm run dev   # UI dev (or `npm run tauri dev`)
```

`apps/desktop/src/api.ts` shows the client + auth-header pattern. `services/core_api/` is the API;
`db/schema.sql` is the data model; `docs/10` is what we're taking from you and why.

---

## 12. Still-pending owner inputs (in flux — don't hardcode around them)

- **iCoA vs eCoA** detailed semantics/identifier rules (owner to specify).
- The **IMB final CoQ template** (owner to supply) — will define the COQ Generator's canonical
  template + the mandatory-token contract.
- Per-type seed counters for iCoA/eCoA (CoQ known: 2025→0032, 2026→0009).

---

**Bottom line:** you make it beautiful and usable in Variation F; I make it correct, compliant, and
wired. The tokens, the generated types, and the OpenAPI are the handshake. Let's build.
