# 10 — PhytoCert Design System: In-Depth Comparison & Adoption Decision

> Analysis of the **"PhytoCert Design System"** + **`phytocert_app`** prototype (delivered to
> Google Drive from a parallel "Claude Design" run on the *same initial brief*) against the
> COQ_GEN work in this repo. Conclusion first: **the two are complementary — PhytoCert is the
> polished UI/UX + design-system layer we lack; COQ_GEN is the SOP-accurate engine/domain core it
> lacks. We adopt PhytoCert's design system and UI/UX, rebuilt as real TSX wired to our backend,
> and reject its domain rules where they conflict with the governing SOPs and your rulings.**

## 10.1 What PhytoCert is

A **design system** + a **clickable desktop-app prototype** for "PhytoCert", a medical-cannabis QC
platform. Per its own readme it was built **only from the two product-specification HTMLs** — *"No
external codebase or Figma was provided… built from the product descriptions and specifications."*
It therefore never saw QCSOP 010 / QCSOP 012 v3, the live KVM4 agents, the real labs, or your
later rulings.

**Contents (Google Drive → My Drive/1. PP/ASSETS/APPS/COQ_GEN/PhytoCert Design System):**

- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `shadows.css`, `borders.css`,
  `motion.css` (a proper CSS-variable token system).
- `components/` — `Button`, `Badge`, `Input`, `Select`, `Textarea`, `DataTable`, `DocumentCard`
  (each `.jsx` + `.d.ts` + `.prompt.md` + `.card.html` specimen).
- `ui_kits/phytocert_app/` and a sibling `phytocert_app/` — the app: `AppShell`, `Dashboard`,
  `IngestionView`, `BatchRecord`, `COQGenerator`, `CertRegister`, `OOSView`, `Icons` (Lucide).
- Artifacts: **`Purely Plant COQ Template.html`** (52 KB), **`Purely Plant Certificate
  Register.html`**, **`Purely Plant eCoA Review Checklist A03.html`** (the QCSOP 012 §6.3.2 / Annex
  A03 checklist), **`Technical Architecture.html`** (72 KB), `_ds_manifest.json`, `_ds_bundle.js`.
- `readme.md`, `SKILL.md` (a Claude-Code-invokable `phytocert-design` skill), `assets/` (logo,
  **`badge-eu-gmp.svg`**), `guidelines/` (specimen cards).

**Design language:** IBM Plex Sans (UI) / Mono (data, batch numbers) / Serif (certificates);
**forest-green** brand (`#2D8F63`) + slate chrome; Lucide icons; status semantics
**Conforms / Out of Specification / Pending / Under Review**; 4px grid; three-zone desktop shell
(220px sidebar, 48px header, content); compact 13px density; GMP copywriting ("never say
passed/failed", ISO dates, no emoji). It's genuinely excellent, coherent UI craft.

**Engineering reality:** the app is a **browser prototype** — `React.createElement` with global
`window.AppShell` / `window.Icons` and inline styles, no build/bundler, no backend, no data layer.
It demonstrates UX; it is not production React.

## 10.2 Side-by-side capability matrix

| Capability | COQ_GEN (this repo) | PhytoCert | Verdict |
|------------|--------------------|-----------|---------|
| **Design system / tokens** | minimal (inline styles in Phase 0 shell) | ✅ full token system + specimens | **Take PhytoCert** |
| **Component library** | none | ✅ Button/Badge/Input/Select/Textarea/DataTable/DocumentCard | **Take PhytoCert** |
| **UI views / UX flows** | Phase 0 connectivity screen only | ✅ Dashboard, Ingestion(drag-drop→OCR→review), BatchRecord, COQGenerator, CertRegister, OOS/NCR | **Take PhytoCert (rebuild as TSX)** |
| **Iconography** | none | ✅ Lucide set + usage map | **Take PhytoCert** |
| **Copywriting / GMP voice** | scattered in docs | ✅ codified rules | **Take PhytoCert** |
| **eCoA Review Checklist (Annex A03)** | referenced in docs only | ✅ concrete HTML | **Take PhytoCert (reconcile to SOP)** |
| **Certificate Register UI** | schema only | ✅ HTML layout | **Take PhytoCert (rewire data)** |
| **Relational data model** | ✅ full (lineage, master store, audit hash-chain) | ❌ none | **Keep COQ_GEN** |
| **DB migrations (Alembic)** | ✅ baseline applies schema.sql | ❌ none | **Keep COQ_GEN** |
| **Backend (FastAPI sidecar)** | ✅ runnable, DB-backed, auth | ❌ none (prototype only) | **Keep COQ_GEN** |
| **Letta gateway + real agent IDs + allow-list** | ✅ | ❌ (mentions Letta, no integration) | **Keep COQ_GEN** |
| **Numbering engine** | ✅ `CoQ-PP-YYYY-NNNN` per-type/year, transactional (QCSOP 012 v3) | ❌ `COQ-FP/IMB-YYYY-NNN-REV` (non-SOP) | **Keep COQ_GEN** |
| **Compliance guard (MK-GMP, OOS, forbidden strings)** | ✅ tested (T6) | ❌ prints "EU GMP Certified" | **Keep COQ_GEN** |
| **SOP traceability** | ✅ docs/09 to QCSOP 010/012 | ❌ never saw the SOPs | **Keep COQ_GEN** |
| **Tests / CI** | ✅ SQL T1–T6, pytest, OpenAPI, CI | ❌ none | **Keep COQ_GEN** |
| **Desktop shell (Tauri)** | ✅ scaffold (spawns sidecar) | ❌ browser-only | **Keep COQ_GEN shell + PhytoCert UI inside it** |

**One-line synthesis:** *PhytoCert = the face; COQ_GEN = the brain.* Put the PhytoCert face on the
COQ_GEN brain.

## 10.3 Domain divergences in PhytoCert we must NOT adopt (reconcile to our SOPs/rulings)

| PhytoCert says | Authoritative (ours) | Action |
|----------------|----------------------|--------|
| "EU GMP Certified Facility"; `badge-eu-gmp.svg` | **MK GMP Certified Facility (MALMED)**; "EU GMP" is hard-blocked on flower docs (your ruling, docs/09 §9.4) | Rewire wording; drop/replace the EU-GMP badge |
| Numbering `COQ-FP-2026-047-A` / `COQ-IMB-2026-031-A` | `CoQ-PP-YYYY-NNNN`, per-type/year monotonic (QCSOP 012 v3) | Keep ours; relabel UI |
| Fictional labs: PhytoAnalytics (Berlin), CannaBio (Vienna), EuroSpec (Amsterdam) | Real labs: **LT-083 UKIM** (Skopje, EN), **LT-005 IJZ** (Cyrillic, MK) | Replace lab data |
| Lineage `PP-CULT/PROC/IMB/PKG-YYYY-NNNN` | our `CB-/PB-/PK-…` (cultivation→production→packaging) | Align identifiers (cosmetic) |
| Mfg Authorisation No. `MFG-MK-2023-00441` | unverified | Confirm with owner before printing |
| 19 parameters (pesticides split a/b into 2 rows) | 18 (pesticides one row, dual method) | Reconcile presentation (both valid) |
| Variety Sativa/Indica emphasis | strain-agnostic; dominance+grade (your ruling) | Keep ours; strain descriptive only |
| **Forest-green brand** | conflicts with the **"Variation F" Navy & Gold** locked system kept by the KVM4 `VariationF` agent | **Owner decision required** — see §10.5 |

## 10.4 Decision

**Adopt** PhytoCert's design system + UI/UX as the COQ_GEN presentation layer, **rebuilt as proper
React + TypeScript components** inside our existing Tauri shell and **wired to the Core API**.
**Reject** its domain rules wherever they conflict with QCSOP 010 / QCSOP 012 v3 and your rulings;
those stay sourced from the database + compliance guard. Concretely:

**Take (port/adapt):**
1. **Design tokens** (`tokens/*.css`) → `apps/desktop/src/styles/tokens.css` (one brand decision pending, §10.5).
2. **Component library** (Button/Badge/Input/Select/Textarea/DataTable/DocumentCard) → typed TSX in `apps/desktop/src/components/`.
3. **View set & UX flows** → real views bound to Core API endpoints: Dashboard, eCoA Ingestion (drag-drop → OCR/agent pipeline → review/confirm), Batch Record (master-parameter table with lab traceability), COQ Generator (template → preview → guard → issue), Certificate Register, **OOS/NCR** (matches our new open-OOS guard).
4. **eCoA Review Checklist (Annex A03)** → reconcile against QCSOP 012 §6.3.2 fields and wire into the eCoA acceptance workflow (status pending_review→accepted/rejected).
5. **Copywriting/GMP voice + status semantics** → `docs/` UI guideline + the Badge component states.
6. **Lucide icon set** + the `phytocert-design` SKILL pattern.

**Reject / rewrite:** EU-GMP wording & badge, the numbering scheme, fictional labs, the
`React.createElement` prototype code (rebuild as TSX), unverified authorisation numbers.

## 10.5 Brand identity — RESOLVED (owner ruling)

Two candidate identities existed: PhytoCert **forest green `#2D8F63`** vs the locked **"Variation F"
Navy `#1B3A5C` & Gold `#A67C2E`** system (KVM4 `VariationF` agent + `coa_track` templates).

**Owner ruling (confirmed): Variation F (Navy & Gold) EVERYWHERE** — both the application chrome and
the rendered regulated documents (CoQ/CoA/Spec). Therefore:

- We adopt PhytoCert's **design-system architecture, component set, typography discipline, UX flows,
  and view structure**, but **re-skin the token palette to Navy & Gold** (Variation F). Forest green
  is retired.
- The `tokens/colors.css` we port will carry the Variation F palette (navy/navy-deep/navy-mid/
  gold/gold-bright/gold-tint, status green/amber/red, zebra surfaces) rather than PhytoCert green.
- PhytoCert's `badge-eu-gmp.svg` is dropped (per the MK-GMP ruling, docs/09 §9.4); certificate
  identity follows Variation F as kept by the `VariationF` agent.
- IBM Plex Sans/Mono/Serif typography, Lucide icons, status semantics, copywriting rules, density,
  and the three-zone shell are adopted unchanged (they're brand-neutral craft).

## 10.6 Status

Analysis complete; **UI porting is paused per owner direction** ("just the analysis for now"). When
resumed, execute the §10.7 roadmap below with the Variation F palette.

## 10.7 Integration roadmap (slots into docs/07)

1. **Phase 1.5 — UI foundation:** vendor the chosen token set + port the component library + the
   `AppShell` (sidebar/header/nav) as TSX in `apps/desktop`; keep the Tauri shell + sidecar spawn.
2. **Wire Dashboard + Certificate Register** to read-only Core API endpoints (specs already live;
   add batches/register endpoints).
3. **eCoA Ingestion view** → the real OCR/agent pipeline (Phase 1–2 backend) with the Annex A03
   review/accept step.
4. **Batch Record view** → master-parameter resolver + provenance (source eCoA code/date/lab).
5. **COQ Generator view** → the COQ engine: template select → live preview → **compliance guard**
   (MK-GMP, gaps, open-OOS) → transactional numbering → dual e-sign → PDF/A export.
6. **OOS/NCR view** → the open-OOS deviation workflow that blocks CoQ issuance.

## 10.8 Provenance note

PhytoCert source lives in the owner's Google Drive (not vendored wholesale here to avoid importing
the green-branded, non-SOP assets before the §10.5 brand decision). Files are pulled per-view as we
build, reconciled to the SOP-accurate backend. The full design-system spec (readme) is summarised
above; the `phytocert-design` SKILL can be installed for design work once the brand is settled.
