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
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
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
    doc_class       TEXT,                     -- flower_coq | flower_coa | img_spec | NULL=all
    term            TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE controlled_vocabulary IS
  'e.g. (forbidden_string, flower_coq, "EU GMP"); (gmp_wording, flower_coq, "MK GMP Certified Facility")';

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

CREATE TABLE product_spec (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_code           TEXT NOT NULL,            -- QCSP-IMB-001
    version             TEXT NOT NULL,            -- v02
    category            TEXT NOT NULL,            -- IMG | IPM | FP | IMB
    title               TEXT NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from      DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (spec_code, version)
);

CREATE TABLE production_batch (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number            TEXT NOT NULL UNIQUE,    -- PB-2026-0011  (the brief's "Batch Number")
    cultivation_batch_id    UUID NOT NULL REFERENCES cultivation_batch(id),
    product_spec_id         UUID REFERENCES product_spec(id),
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

CREATE TABLE ecoa_document (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_code           TEXT NOT NULL,                  -- lab report no. or eCoA-PP-YYYY-NNNN
    source_file_id          UUID NOT NULL REFERENCES source_file(id),
    institution_id          UUID REFERENCES institution(id),
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

CREATE TABLE coq_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,            -- CoQ_Template_v02_VariationF
    version         TEXT NOT NULL,
    html            TEXT NOT NULL,            -- uploaded HTML (validated vs token contract)
    doc_class       TEXT NOT NULL DEFAULT 'flower_coq',
    render_engine   TEXT NOT NULL DEFAULT 'weasyprint', -- weasyprint|playwright
    token_manifest  JSONB NOT NULL DEFAULT '{}'::jsonb, -- tokens the template declares/uses
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by     UUID REFERENCES app_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- per-year monotonic counter (QCSOP 012 v3) - allocated under SELECT ... FOR UPDATE
CREATE TABLE coq_sequence (
    year            INTEGER PRIMARY KEY,
    last_value      INTEGER NOT NULL DEFAULT 0
);
-- seed from known register state
INSERT INTO coq_sequence(year, last_value) VALUES (2025, 32), (2026, 9)
    ON CONFLICT (year) DO NOTHING;

CREATE TABLE coq (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coq_number              TEXT UNIQUE,             -- CoQ-PP-YYYY-NNNN (null while draft)
    packaging_batch_id      UUID NOT NULL REFERENCES packaging_batch(id),
    production_batch_id      UUID NOT NULL REFERENCES production_batch(id),
    spec_reference          TEXT NOT NULL,           -- QCSP-IMB-001 v02
    template_id             UUID NOT NULL REFERENCES coq_template(id),
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

-- Certificate Issuance Register (QCLB 020 / Annex A05), 1:1 with coq
CREATE TABLE register_entry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coq_id              UUID NOT NULL UNIQUE REFERENCES coq(id),
    entry_no            INTEGER NOT NULL,
    cert_type           TEXT NOT NULL DEFAULT 'CoQ',
    seq_no              INTEGER NOT NULL,
    year                INTEGER NOT NULL,
    certificate_number  TEXT NOT NULL,
    issuing_lab         TEXT NOT NULL DEFAULT 'Purely Plant QC',
    sample_id           TEXT,
    batch_no            TEXT NOT NULL,
    product_name        TEXT NOT NULL,
    spec_ref            TEXT NOT NULL,
    sampling_date       DATE,
    analysis_date       DATE,
    issue_date          DATE NOT NULL,
    prepared_by         TEXT NOT NULL,           -- Senior QC Analyst / Blagoj Nikolov
    reviewed_by         TEXT NOT NULL,           -- Head of QC / Jovana
    status              TEXT NOT NULL,
    oos_ref             TEXT,
    archive_ref         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (year, seq_no)                         -- uq_register_seq_per_year
);

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
