# COQ HTML Template Contract (Variation F)

COQ layouts are **user‑uploaded HTML** rendered by the [COQ engine](../../docs/06_COQ_GENERATION_ENGINE.md).
Flexibility in formatting is allowed *above a validated mandatory floor*: a template that omits a
mandatory release field, or bakes in a forbidden string, is **rejected at upload**.

## How rendering works

1. The engine resolves the per‑batch **master parameter store** + lineage + register data into a
   stable **data context** (below).
2. The template's `{{ ... }}` placeholders are bound with **Jinja2** in a **sandboxed** environment
   (no filesystem, no network, autoescape on, fixed filter allow‑list).
3. The bound HTML is rendered to **PDF/A** (`WeasyPrint`) or pixel‑exact (`Playwright‑Chromium`),
   selected per template via `coq_template.render_engine`.
4. The rendered output text is scanned for forbidden strings (e.g., `EU GMP` on flower COQs)
   before the certificate can be signed/issued.

## Upload validation (enforced)

- **Mandatory tokens present** — every field in [docs/06 §6.3](../../docs/06_COQ_GENERATION_ENGINE.md)
  must be referenced by the template (the engine extracts a `token_manifest` and diffs it against
  `controlled_vocabulary(domain='mandatory_token')`).
- **No forbidden static strings** — the template body must not hard‑code `EU GMP` for
  `doc_class = flower_coq`. Use `{{ gmp_wording }}` (resolves to `MK GMP Certified Facility`).
- **Source mapping surfaced** — the results loop must render each line's `source_document_code`
  and `source_document_date` (the brief's "map every parameter result back to its source eCOA").
- **Two signatory blocks** — exactly two, no Qualified Person block.

## Data context available to templates

```jinja
{# Document control #}
{{ coq.number }}                 {# CoQ-PP-YYYY-NNNN (blank in preview) #}
{{ coq.issue_date }}  {{ coq.disposition }}  {{ coq.spec_reference }}
{{ template.name }}  {{ template.version }}

{# Identity + lineage #}
{{ batch.product_name }}  {{ batch.strain }}  {{ batch.thc_grade }}
{{ batch.production_batch_number }}            {# Batch Number #}
{{ batch.packaging_batch_number }}            {# Packaging Batch Number #}
{{ lineage.cultivation_batch_number }}  {{ lineage.production_batch_number }}

{# GMP wording (NEVER hard-code "EU GMP" on a flower COQ) #}
{{ gmp_wording }}                {# "MK GMP Certified Facility" (MALMED, N. Macedonia) #}
{{ manufacturer.name }}  {{ manufacturer.address }}

{# Results — each line MUST surface its source eCOA mapping #}
{% for line in lines %}
  {{ line.param_name }}        {{ line.method }}
  {{ line.acceptance_text }}   {{ line.result_display }}   {{ line.verdict }}
  {{ line.source_institution_name }}
  {{ line.source_document_code }}  {{ line.source_document_date }}
{% endfor %}

{# Gaps (if any are allowed to render at all) #}
{% for g in unmatched_specs %}{{ g }}{% endfor %}

{# Testing institutions (credentials) #}
{% for inst in institutions %}
  {{ inst.name }}  {{ inst.address }}  {{ inst.credentials }}  {{ inst.lab_code }}
{% endfor %}

{# Narrative + dates #}
{{ compliance_summary }}
{{ dates.sampling }}  {{ dates.analysis }}  {{ dates.issue }}

{# Signatories — exactly two, no QP #}
{% for s in signatories %}
  {{ s.name }}  {{ s.role }}  {{ s.meaning }}  {{ s.signed_at }}
{% endfor %}
```

## Variation F visual identity (reference)

The canonical templates (`CoQ_Template_v02_VariationF.html`) use the Navy & Gold palette — navy
`#1B3A5C`, gold `#A67C2E`, gold‑tint `#FBF6E9`, zebra table rows `#F4F7FB`, a **green verdict
band** for the overall disposition, and dual sign‑off (Blagoj Nikolov + Jovana). Import the
existing template from the `coa_track` template set (`templates/v02_canonical_variationF/`) as the
first registered template; it already satisfies the mandatory‑token contract.

> Place uploaded templates here (or register them in `coq_template`). This directory documents the
> contract; the engine validates every upload against it.
