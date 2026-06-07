"""Sandboxed HTML rendering (Jinja2).

Renders a document's data context into HTML using the active uploaded template, or a
minimal built-in fallback when none is registered yet (so preview/issue work end-to-end
before the final Variation F templates are uploaded). The sandbox blocks attribute access
to dunders and disallows arbitrary calls — uploaded HTML cannot exfiltrate or execute.
"""
from __future__ import annotations

from jinja2 import select_autoescape
from jinja2.sandbox import SandboxedEnvironment

_env = SandboxedEnvironment(autoescape=select_autoescape(default=True), enable_async=False)

# Minimal, brand-neutral fallback — real layout comes from the uploaded Variation F template.
FALLBACK_TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<title>{{ doc_title }} {{ coq.number or '' }}</title></head><body>
<h1>{{ doc_title }}</h1>
<p><strong>{{ coq.number or 'DRAFT' }}</strong> — {{ coq.spec_reference }}</p>
<p>Product: {{ batch.product_name }} — {{ batch.dominance }} {{ batch.grade_designation or batch.grade }}</p>
<p>Batch: {{ batch.production_batch_number }}{% if batch.packaging_batch_number %} / {{ batch.packaging_batch_number }}{% endif %}</p>
<p>Strain (descriptive): {{ batch.strain or '—' }}</p>
<table border="1" cellspacing="0" cellpadding="3"><thead><tr>
<th>Parameter</th><th>Method</th><th>Acceptance</th><th>Result</th><th>Verdict</th>
<th>Testing lab</th><th>Source cert</th><th>Date</th></tr></thead><tbody>
{% for l in lines %}<tr><td>{{ l.param_name }}</td><td>{{ l.method or '' }}</td>
<td>{{ l.acceptance_text or '' }}</td><td>{{ l.result_display or '' }}</td><td>{{ l.verdict }}</td>
<td>{{ l.source_institution_name or '' }}</td><td>{{ l.source_document_code or '' }}</td>
<td>{{ l.source_document_date or '' }}</td></tr>{% endfor %}
</tbody></table>
<p>Disposition: {{ coq.disposition or '—' }}</p>
<p>{{ gmp_wording }}</p>
{% for s in signatories %}<p>{{ s.meaning }}: {{ s.role }}</p>{% endfor %}
</body></html>"""


def render(template_html: str | None, context: dict) -> str:
    html = template_html or FALLBACK_TEMPLATE
    return _env.from_string(html).render(**context)
