-- ============================================================================
-- COQ_GEN — Centralised QC database schema (PostgreSQL 16 + pgvector)
-- ----------------------------------------------------------------------------
-- Satisfies the brief's data-management requirements:
--   * store ALL eCOA data, indexed by Batch Number and Packaging Batch Number
--   * lineage: cultivation -> production -> packaging
--   * per-batch master parameter store = single source of truth for COQ
--   * every COQ line maps back to its source eCOA document code + date
--   * full ALCOA+ audit trail, numbering register, e-signature ledger
--
-- Conventions:
--   * surrogate PKs = UUID (time-ordered uuidv7 from the app layer)
--   * all timestamps stored UTC (timestamptz)
--   * human-facing codes (CoQ-PP-YYYY-NNNN, QCSP-...) are separate text columns
--   * "staged -> committed -> superseded" lifecycle = ALCOA+ (never destructive)
-- Apply with Alembic in validated environments; this file is the canonical DDL.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid(), digest()

-- ---------------------------------------------------------------------------
-- 0. Reference / configuration (editable business rules, themselves audited)
-- ---------------------------------------------------------------------------

CREATE TABLE app_user (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        TEXT NOT NULL UNIQUE,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL,            -- qc_analyst | qc_manager | head_of_qc | admin
                                              -- planner roles: operator | hod | qa | qp | executive | admin
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    -- Planner authn/identity (added with the apps/planner module; nullable for legacy rows).
    password_hash   TEXT,                     -- bcrypt ($2*); NULL = cannot log in to the planner
    email           TEXT UNIQUE,
    avatar_url      TEXT,
    dept_id         UUID,                     -- FK added in §7 (planner_department) to avoid forward ref
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_config (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES app_user(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- forbidden strings, GMP wording, signatory roster, mandatory COQ tokens, etc.
CREATE TABLE controlled_vocabulary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          TEXT NOT NULL,            -- forbidden_string | gmp_wording | signatory | mandatory_token | numbering
    doc_class       TEXT,                     -- flower_coq | flower_icoa | flower_spec | NULL=all
    term            TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE controlled_vocabulary IS
  'e.g. (forbidden_string, flower_coq, "EU GMP"); (gmp_wording, flower_coq, "MK GMP Certified Facility")';

-- Owner ruling (confirmed): flower CoQ/CoA/Spec must print "MK GMP Certified Facility"
-- and must NEVER contain the literal "EU GMP" (hard block, audited override only).
INSERT INTO controlled_vocabulary(domain, doc_class, term, payload) VALUES
  ('forbidden_string','flower_coq','EU GMP','{"action":"block","reason":"owner ruling 2026-06: flower docs are MK GMP","override":"audited"}'),
  ('forbidden_string','flower_icoa','EU GMP','{"action":"block"}'),
  ('forbidden_string','flower_spec','EU GMP','{"action":"block"}'),
  ('gmp_wording','flower_coq','MK GMP Certified Facility','{"authority":"MALMED","country":"North Macedonia"}'),
  ('signatory','flower_coq','Prepared & Approved','{"role":"Senior QC Analyst / Head of Laboratory","slot":1}'),
  ('signatory','flower_coq','Reviewed & Approved','{"role":"Head of QC","slot":2,"qualified_person":false}')
ON CONFLICT DO NOTHING;

-- Reference data the certificate templates render (manufacturer identity, COQ document
-- metadata, generic product descriptors). Editable config, not code.
INSERT INTO app_config(key, value, description) VALUES
  ('manufacturer',
   '{"name":"Purely Plant DOOEL","address":"Industriska ul. 9, s. Kojlija 1043, Petrovec, North Macedonia","gmp_line":"MK GMP Certified Facility (MALMED, Republic of North Macedonia)","motto":"The Future of Cannabis"}',
   'Manufacturer identity printed on certificates'),
  ('coq_meta',
   '{"sop_ref":"QCSOP 012 v3","annex":"Annex A02","record_code":"QCLB 020 / Annex A05","coding_wi":"QCSOP 012 v3 §6.9.1","version":"v.01","notice_text":"This Certificate of Quality is a QC-internal specification-conformance aggregation supporting Qualified Person batch release; it is not itself an Annex 16 (EMA) batch release certificate."}',
   'CoQ document control metadata'),
  ('product_meta',
   '{"title":"Cannabis flos","description":"Dried Cannabis Flower for Medicinal Use","standard_line":"Ph. Eur. Monograph 3028 · DAB 2018"}',
   'Generic product descriptors for Cannabis flos')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Lineage: cultivation -> production -> packaging
-- ---------------------------------------------------------------------------

CREATE TABLE cultivation_batch (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number        TEXT NOT NULL UNIQUE,     -- e.g. CB-2026-0007
    strain              TEXT NOT NULL,
    thc_grade           TEXT,                     -- strain-specific THC grade (noted separately per QCSOP 010)
    grow_site           TEXT,
    harvest_date        DATE,
    quantity_kg         NUMERIC(12,3),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Master Specification Register (QCSOP 010 §6.10): one row per spec version.
-- Coding (QCSOP 010 §6.6, via QAWI 002): QCSP-[CAT]-[NNN] v.[VV].
-- Owner policy: specs are STRAIN-AGNOSTIC. QCSP-IMB-001 / QCSP-FP-001 apply to all
-- products; classification is by cannabinoid dominance (THC|CBD) + grade tier (I-V),
-- never by strain. Strain is recorded on the batch and printed on the CoQ descriptively.
CREATE TABLE product_spec (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_code           TEXT NOT NULL,            -- QCSP-IMB-001
    version             TEXT NOT NULL,            -- v.01
    category            TEXT NOT NULL,            -- IMG | IPM | FP | IMB  (QCSOP 010 §6.6)
    title               TEXT NOT NULL,
    dominance           TEXT,                     -- THC | CBD  (this revision: THC-dominant, CBD < 1.0%)
    status              TEXT NOT NULL DEFAULT 'active', -- active | superseded | withdrawn
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from      DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (spec_code, version)
);

CREATE TABLE production_batch (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number            TEXT NOT NULL UNIQUE,    -- PB-2026-0011  (the brief's "Batch Number")
    cultivation_batch_id    UUID NOT NULL REFERENCES cultivation_batch(id),
    product_spec_id         UUID REFERENCES product_spec(id),  -- QCSP-IMB-001 / QCSP-FP-001 (strain-agnostic)
    dominance               TEXT,                   -- THC | CBD  (classification driver, not strain)
    grade                   TEXT,                   -- grade tier 'I'..'V' (maps to spec_grade.grade)
    grade_designation       TEXT,                   -- 'THC27' (denormalised from spec_grade for the CoQ)
    product_name            TEXT NOT NULL,
    production_date         DATE,
    quantity_kg             NUMERIC(12,3),
    status                  TEXT NOT NULL DEFAULT 'in_progress', -- in_progress|testing|released|rejected
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prodbatch_cultivation ON production_batch(cultivation_batch_id);
CREATE INDEX idx_prodbatch_spec        ON production_batch(product_spec_id);

CREATE TABLE packaging_batch (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    packaging_batch_number  TEXT NOT NULL UNIQUE,    -- PK-2026-0021 (the brief's "Packaging Batch Number")
    production_batch_id      UUID NOT NULL REFERENCES production_batch(id),
    packaging_date          DATE,
    pack_format             TEXT,
    quantity_units          INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pkgbatch_production ON packaging_batch(production_batch_id);

-- ---------------------------------------------------------------------------
-- 2. Parameter ontology (heterogeneous, multilingual reconciliation)
-- ---------------------------------------------------------------------------

CREATE TABLE parameter_dictionary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_key   TEXT NOT NULL UNIQUE,     -- TAMC, TYMC, Pb, Cd, THC, CBD, Aw, E_coli ...
    display_name    TEXT NOT NULL,            -- Total Aerobic Microbial Count
    category        TEXT NOT NULL,            -- microbiology|heavy_metals|pesticides|mycotoxins|cannabinoids|water_activity|residual_solvents|foreign_matter
    canonical_unit  TEXT,                     -- CFU/g, ppm, % w/w, aw
    default_method_family TEXT,               -- e.g. "Ph.Eur 2.6.12 / USP <61>"
    -- Test ownership: which path produces this parameter for a batch.
    --   internal      = Purely Plant QC lab issues an iCoA (referenced in the CoQ)
    --   external      = outsourced/contracted lab issues an eCoA (ingested)
    --   not_performed = capability not available in-house (e.g. HPTLC Test C)
    default_source  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE institution (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_code        TEXT UNIQUE,              -- LT-083, LT-005
    name            TEXT NOT NULL,            -- UKIM, IJZ
    address         TEXT,
    credentials     TEXT,                     -- accreditation (ISO/IEC 17025 ref etc.)
    default_language TEXT,                    -- en, mk
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- every way a lab prints a parameter -> canonical key (the learning loop, persisted)
CREATE TABLE lab_synonym (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_key   TEXT NOT NULL REFERENCES parameter_dictionary(canonical_key),
    institution_id  UUID REFERENCES institution(id),  -- NULL = generic synonym
    language        TEXT NOT NULL,
    printed_term    TEXT NOT NULL,
    confirmed_by    UUID REFERENCES app_user(id),     -- set when a human confirmed the mapping
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (canonical_key, institution_id, language, printed_term)
);
CREATE INDEX idx_synonym_term ON lab_synonym (lower(printed_term));

-- spec requirements (one row per required parameter in a spec version)
CREATE TABLE spec_parameter (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_spec_id     UUID NOT NULL REFERENCES product_spec(id) ON DELETE CASCADE,
    canonical_key       TEXT REFERENCES parameter_dictionary(canonical_key),
    param_name          TEXT NOT NULL,        -- as written in the spec
    method              TEXT,                 -- required/expected method family
    operator            TEXT,                 -- <= , < , >= , = , range , absent
    limit_low           NUMERIC,
    limit_high          NUMERIC,
    limit_text          TEXT,                 -- e.g. "Absent / 1 g", "Conforms"
    unit                TEXT,
    is_mandatory        BOOLEAN NOT NULL DEFAULT TRUE,
    display_order       INTEGER,
    UNIQUE (product_spec_id, param_name)
);

-- THC-dominant grade tiers per spec (e.g. QCSP-IMB-001: Grades I-V, THC27..THC9).
-- The COQ states the batch grade + its THC acceptance range; the assay verdict for
-- the THC parameter is evaluated against the selected grade's [thc_low, thc_high].
CREATE TABLE spec_grade (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_spec_id     UUID NOT NULL REFERENCES product_spec(id) ON DELETE CASCADE,
    grade               TEXT NOT NULL,        -- 'I' .. 'V'
    designation         TEXT,                 -- THC27
    product_code        TEXT,                 -- PP-sFP-THC27:CBD1
    thc_target          NUMERIC,              -- 27.0 (% w/w)
    thc_tolerance       TEXT,                 -- ±2%
    thc_low             NUMERIC,              -- 25.0
    thc_high            NUMERIC,              -- 28.9
    cbd_max             NUMERIC,              -- 1.0 (% w/w)
    display_order       INTEGER,
    UNIQUE (product_spec_id, grade)
);

-- ---------------------------------------------------------------------------
-- 3. Source files + eCOA documents + extracted parameters + chunks
-- ---------------------------------------------------------------------------

CREATE TABLE source_file (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sha256          BYTEA NOT NULL UNIQUE,    -- content address (dedup + reproducibility)
    filename        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    byte_size       BIGINT NOT NULL,
    storage_uri     TEXT NOT NULL,           -- encrypted object store path
    page_count      INTEGER,
    is_scanned      BOOLEAN,                 -- determined by text-layer probe
    uploaded_by     UUID REFERENCES app_user(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source certificate (QCSOP 012 v3): holds BOTH internal CoAs (iCoA) and external
-- CoAs (eCoA). The CoQ aggregates iCoA + eCoA results for a batch. (Table name kept
-- as ecoa_document for continuity; implementation may rename to source_certificate.)
CREATE TABLE ecoa_document (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_code           TEXT NOT NULL,                  -- lab report no., eCoA-PP-YYYY-NNNN, or iCoA-PP-YYYY-NNNN
    cert_type               TEXT NOT NULL DEFAULT 'eCoA',   -- iCoA | eCoA  (QCSOP 012 v3)
    origin                  TEXT NOT NULL DEFAULT 'external',-- internal | external
    register_status         TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | accepted | rejected | voided (QCSOP 012 §6.3.2)
    source_file_id          UUID NOT NULL REFERENCES source_file(id),
    institution_id          UUID REFERENCES institution(id),-- NULL for internal iCoA (Purely Plant QC lab)
    production_batch_id      UUID REFERENCES production_batch(id),
    -- denormalised, indexed lookup keys (the brief's required indexes)
    batch_number            TEXT,
    packaging_batch_number  TEXT,
    doc_type                TEXT NOT NULL DEFAULT 'cannabis_coa', -- cannabis_coa|water_quality|other
    language                TEXT,
    issue_date              DATE,
    analysis_date           DATE,
    sampling_date           DATE,
    extraction_confidence   NUMERIC(4,3),
    status                  TEXT NOT NULL DEFAULT 'received', -- received|parsed|extracted|committed
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_code, institution_id)
);
CREATE INDEX idx_ecoa_batch_number ON ecoa_document(batch_number);
CREATE INDEX idx_ecoa_pkg_batch    ON ecoa_document(packaging_batch_number);
CREATE INDEX idx_ecoa_prodbatch    ON ecoa_document(production_batch_id);
CREATE INDEX idx_ecoa_institution  ON ecoa_document(institution_id);

-- one row per analytical line per eCOA (staged -> committed -> superseded)
CREATE TABLE ecoa_parameter (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecoa_document_id    UUID NOT NULL REFERENCES ecoa_document(id) ON DELETE CASCADE,
    canonical_key       TEXT REFERENCES parameter_dictionary(canonical_key), -- null until matched
    printed_param_name  TEXT NOT NULL,        -- exactly as printed (lab language)
    method              TEXT,
    acceptance_text     TEXT,                 -- acceptance criteria as printed
    operator            TEXT,
    limit_low           NUMERIC,
    limit_high          NUMERIC,
    result_value        NUMERIC,
    result_text         TEXT,                 -- for non-numeric results (Conforms, ND, <LOQ)
    result_qualifier    TEXT,                 -- <, >, <=, ND, <LOQ
    unit                TEXT,
    -- provenance
    page                INTEGER,
    bbox                JSONB,                -- {x0,y0,x1,y1} in PDF coords
    raw_text            TEXT,
    confidence          NUMERIC(4,3),
    asserted_by_agent   TEXT,                 -- agent name/id
    asserted_by_model   TEXT,                 -- deepseek-v4-flash, gpt-4o ...
    status              TEXT NOT NULL DEFAULT 'staged', -- staged|committed|superseded|rejected
    supersedes_id       UUID REFERENCES ecoa_parameter(id),
    reviewed_by         UUID REFERENCES app_user(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ecoaparam_doc       ON ecoa_parameter(ecoa_document_id);
CREATE INDEX idx_ecoaparam_canonical ON ecoa_parameter(canonical_key);
CREATE INDEX idx_ecoaparam_status    ON ecoa_parameter(status);

-- RAG/RAAG chunks + embeddings (interoperable with Letta: text-embedding-3-small, 1536-d)
CREATE TABLE ecoa_chunk (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ecoa_document_id    UUID NOT NULL REFERENCES ecoa_document(id) ON DELETE CASCADE,
    chunk_index         INTEGER NOT NULL,
    content             TEXT NOT NULL,
    page                INTEGER,
    section             TEXT,                 -- header|results_table|method|signatures|footer
    bbox                JSONB,
    embedding           vector(1536),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ecoa_document_id, chunk_index)
);
CREATE INDEX idx_ecoachunk_doc ON ecoa_chunk(ecoa_document_id);
-- ANN index (build after bulk load; hnsw for recall, ivfflat for memory)
CREATE INDEX idx_ecoachunk_embed ON ecoa_chunk USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 4. Master parameter store = single source of truth (per production batch)
-- ---------------------------------------------------------------------------

CREATE TABLE master_parameter (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_batch_id         UUID NOT NULL REFERENCES production_batch(id),
    spec_parameter_id           UUID REFERENCES spec_parameter(id),
    canonical_key               TEXT REFERENCES parameter_dictionary(canonical_key),
    -- chosen evidence
    selected_ecoa_parameter_id  UUID REFERENCES ecoa_parameter(id),
    result_value                NUMERIC,
    result_text                 TEXT,
    result_qualifier            TEXT,
    result_unit                 TEXT,
    verdict                     TEXT NOT NULL DEFAULT 'pending', -- pass|fail|pending|not_tested
    -- source mapping (brief: map back to source eCOA code + date)
    source_institution_id       UUID REFERENCES institution(id),
    source_document_code        TEXT,
    source_document_date        DATE,
    -- judgement record
    confidence                  NUMERIC(4,3),
    selection_reason            TEXT,
    status                      TEXT NOT NULL DEFAULT 'draft', -- draft|confirmed|superseded
    supersedes_id               UUID REFERENCES master_parameter(id),
    confirmed_by                UUID REFERENCES app_user(id),
    confirmed_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_master_batch     ON master_parameter(production_batch_id);
CREATE INDEX idx_master_canonical ON master_parameter(canonical_key);
CREATE INDEX idx_master_status    ON master_parameter(status);
-- one confirmed row per (batch, spec parameter)
CREATE UNIQUE INDEX uq_master_confirmed
    ON master_parameter(production_batch_id, spec_parameter_id)
    WHERE status = 'confirmed';

-- ---------------------------------------------------------------------------
-- 5. COQ templates, certificates, lines, numbering, register, signatures
-- ---------------------------------------------------------------------------

-- Versioned template store for ALL documents the app GENERATES (iCoA, CoQ, CoA,
-- Spec). Uploading a new .html version supersedes the prior active template for
-- that doc_type; future documents render with the active version, while issued
-- documents keep the exact version they were rendered with (immutability).
CREATE TABLE document_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type        TEXT NOT NULL,            -- icoa (== internal CoA) | coq | spec
    name            TEXT NOT NULL,            -- e.g. CoQ_Template_v02_VariationF
    version         TEXT NOT NULL,
    html            TEXT NOT NULL,            -- uploaded HTML (validated vs token contract)
    sha256          BYTEA,                    -- content hash of the html
    doc_class       TEXT NOT NULL DEFAULT 'flower_coq',
    render_engine   TEXT NOT NULL DEFAULT 'weasyprint', -- weasyprint|playwright
    token_manifest  JSONB NOT NULL DEFAULT '{}'::jsonb, -- tokens the template declares/uses
    status          TEXT NOT NULL DEFAULT 'active',      -- active | superseded | draft
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    supersedes_id   UUID REFERENCES document_template(id),
    effective_from  DATE,
    uploaded_by     UUID REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (doc_type, name, version)
);
-- at most one active template per doc_type (the version future documents use)
CREATE UNIQUE INDEX uq_doctemplate_active ON document_template(doc_type) WHERE is_active;

-- Per-(certificate type, year) strictly-monotonic counter (QCSOP 012 v3 §6.9.1):
-- "next sequential number for EACH certificate type within EACH calendar year ...
-- no numbers skipped, reused, or reassigned; gaps are ALCOA+ data-integrity events."
-- Allocated under SELECT ... FOR UPDATE inside the issuing transaction.
-- cert_type: iCoA (internal CoA) | eCoA (external CoA) | CoQ (aggregation).
CREATE TABLE cert_sequence (
    cert_type       TEXT NOT NULL,            -- iCoA | eCoA | CoQ
    year            INTEGER NOT NULL,
    last_value      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (cert_type, year)
);
-- seed CoQ counters from the known register state (2025 -> 0032, 2026 -> 0009);
-- iCoA/eCoA counters are created on first use per year.
INSERT INTO cert_sequence(cert_type, year, last_value) VALUES ('CoQ',2025,32),('CoQ',2026,9)
    ON CONFLICT (cert_type, year) DO NOTHING;

CREATE TABLE coq (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coq_number              TEXT UNIQUE,             -- CoQ-PP-YYYY-NNNN (null while draft)
    packaging_batch_id      UUID NOT NULL REFERENCES packaging_batch(id),
    production_batch_id      UUID NOT NULL REFERENCES production_batch(id),
    spec_reference          TEXT NOT NULL,           -- QCSP-IMB-001 v02
    template_id             UUID NOT NULL REFERENCES document_template(id),  -- doc_type='coq'
    disposition             TEXT,                    -- released|rejected|on_hold
    compliance_summary      TEXT,
    status                  TEXT NOT NULL DEFAULT 'draft', -- draft|numbered|rendered|signed|issued|voided
    pdf_source_file_id      UUID REFERENCES source_file(id),
    pdf_sha256              BYTEA,
    issued_at               TIMESTAMPTZ,
    created_by              UUID REFERENCES app_user(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coq_pkg_batch  ON coq(packaging_batch_id);
CREATE INDEX idx_coq_batch      ON coq(production_batch_id);
CREATE INDEX idx_coq_status     ON coq(status);

-- snapshot of each certified line at issue time (immutability of a signed COQ)
CREATE TABLE coq_line (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coq_id                  UUID NOT NULL REFERENCES coq(id) ON DELETE CASCADE,
    master_parameter_id     UUID REFERENCES master_parameter(id),
    display_order           INTEGER,
    param_name              TEXT NOT NULL,
    method                  TEXT,
    acceptance_text         TEXT,
    result_display          TEXT NOT NULL,           -- formatted result + unit + qualifier
    verdict                 TEXT NOT NULL,           -- pass|fail
    -- frozen source mapping
    source_institution_name TEXT,
    source_document_code    TEXT NOT NULL,
    source_document_date    DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coqline_coq ON coq_line(coq_id);

-- Certificate Issuance Register (QCSOP 012 v3 §6.9 / QCLB 020 / Annex A05).
-- Generalised to ALL certificate types (iCoA, eCoA, CoQ). Each row references
-- either a CoQ or a source certificate (iCoA/eCoA). Numbering is monotonic
-- per (cert_type, year) -> the unique constraint enforces no gaps/dupes per type.
CREATE TABLE register_entry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cert_type           TEXT NOT NULL DEFAULT 'CoQ',  -- iCoA | eCoA | CoQ
    coq_id              UUID REFERENCES coq(id),                 -- set when cert_type=CoQ
    ecoa_document_id    UUID REFERENCES ecoa_document(id),       -- set when cert_type=iCoA/eCoA
    entry_no            INTEGER NOT NULL,
    seq_no              INTEGER NOT NULL,
    year                INTEGER NOT NULL,
    certificate_number  TEXT NOT NULL,
    issuing_lab         TEXT NOT NULL DEFAULT 'Purely Plant QC',
    sample_id           TEXT,
    batch_no            TEXT,
    product_name        TEXT,
    spec_ref            TEXT,
    sampling_date       DATE,
    analysis_date       DATE,
    issue_date          DATE NOT NULL,
    prepared_by         TEXT,                    -- CoQ: Senior QC Analyst / Head of Laboratory
    reviewed_by         TEXT,                    -- CoQ: Head of QC ("Reviewed and Approved")
    status              TEXT NOT NULL,           -- pending_review | accepted | active | superseded | voided
    oos_ref             TEXT,
    archive_ref         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT register_subject_ck CHECK (coq_id IS NOT NULL OR ecoa_document_id IS NOT NULL),
    UNIQUE (cert_type, year, seq_no)             -- monotonic per type per year (QCSOP 012 v3 §6.9.1)
);
CREATE UNIQUE INDEX uq_register_coq ON register_entry(coq_id) WHERE coq_id IS NOT NULL;

-- e-signature ledger (Annex 11 §14), exactly 2 / no QP enforced at app layer
CREATE TABLE signature (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coq_id          UUID NOT NULL REFERENCES coq(id) ON DELETE CASCADE,
    signer_id       UUID NOT NULL REFERENCES app_user(id),
    signer_name     TEXT NOT NULL,
    signer_role     TEXT NOT NULL,               -- QC Manager | Head of QC
    meaning         TEXT NOT NULL,               -- "Prepared & Approved" | "Reviewed"
    method          TEXT NOT NULL DEFAULT 'app_password', -- app_password|pkcs7
    record_sha256   BYTEA NOT NULL,              -- the record bytes this signature binds to
    signed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signature_coq ON signature(coq_id);

-- ---------------------------------------------------------------------------
-- 6. Audit trail (append-only, hash-chained) — ALCOA+ backbone
-- ---------------------------------------------------------------------------

CREATE TABLE audit_event (
    -- gap-free monotonic identity (NOT a UUID) so tampering is detectable
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id        UUID REFERENCES app_user(id),
    action          TEXT NOT NULL,               -- ingest|stage|commit|allocate_number|compliance_block|override|render|sign|issue|export|config_change
    entity_type     TEXT NOT NULL,
    entity_id       UUID,
    payload         JSONB NOT NULL,
    prev_hash       BYTEA,
    payload_hash    BYTEA NOT NULL,              -- sha256(prev_hash || canonical_json(payload))
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_event(entity_type, entity_id);
CREATE INDEX idx_audit_time   ON audit_event(occurred_at);

-- ---------------------------------------------------------------------------
-- 7. Team planner (apps/planner) — GrowFlow-style weekly production board.
--    Independent of the CoQ release workflow; reuses app_user for identity.
--    Domain-flavored (cultivation / QC / QA), bilingual (EN/MK).
-- ---------------------------------------------------------------------------

CREATE TABLE planner_department (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             TEXT NOT NULL UNIQUE,        -- clone | veg | flower | irr | prod | qc | qa | whin | whout | sec | maint
    name_en         TEXT NOT NULL,
    name_mk         TEXT NOT NULL,
    icon            TEXT,                         -- lucide icon hint
    color           TEXT,                         -- hex accent for chips
    handoff_to_id   UUID REFERENCES planner_department(id),  -- next dept in the handoff chain
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- app_user.dept_id -> planner_department (deferred FK; planner_department is defined here)
ALTER TABLE app_user
    ADD CONSTRAINT fk_appuser_dept FOREIGN KEY (dept_id) REFERENCES planner_department(id);

CREATE TABLE planner_task (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID NOT NULL REFERENCES planner_department(id),
    title           TEXT NOT NULL,
    owner_id        UUID REFERENCES app_user(id),
    status          TEXT NOT NULL DEFAULT 'pending',   -- pending|working|review|stuck|postponed|done
    priority        TEXT NOT NULL DEFAULT 'medium',    -- critical|high|medium|low
    week_start      DATE NOT NULL,                      -- the Monday of the task's week
    days            TEXT[] NOT NULL DEFAULT '{}',       -- Mon..Sun
    room            TEXT,
    batch           TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',       -- e.g. EU-GMP, MK-GMP, sampling
    description     TEXT,
    blocker         TEXT,                               -- set when status='stuck'
    created_by      UUID REFERENCES app_user(id),
    position        INTEGER NOT NULL DEFAULT 0,         -- manual ordering within a column
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ                          -- set when status -> done
);
CREATE INDEX idx_planner_task_dept   ON planner_task(department_id);
CREATE INDEX idx_planner_task_owner  ON planner_task(owner_id);
CREATE INDEX idx_planner_task_week   ON planner_task(week_start);
CREATE INDEX idx_planner_task_status ON planner_task(status);

CREATE TABLE planner_task_helper (
    task_id         UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES app_user(id),
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE planner_subtask (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    done            BOOLEAN NOT NULL DEFAULT FALSE,
    position        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_planner_subtask_task ON planner_subtask(task_id);

CREATE TABLE planner_progress_note (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    day             TEXT,                               -- Mon..Sun (optional)
    note            TEXT NOT NULL,
    author_id       UUID REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_planner_note_task ON planner_progress_note(task_id);

CREATE TABLE planner_task_dependency (
    task_id            UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id)
);

CREATE TABLE planner_handoff (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id            UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
    to_department_id   UUID NOT NULL REFERENCES planner_department(id),
    status             TEXT NOT NULL DEFAULT 'requested',  -- requested|accepted|done
    requested_by       UUID REFERENCES app_user(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_planner_handoff_task ON planner_handoff(task_id);
