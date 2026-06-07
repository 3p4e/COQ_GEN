"""Agent route map — the authoritative allow-list (docs/05 §5.1a).

Logical endpoint name -> concrete KVM4 Letta agent id. Agents NOT in this map are
unreachable from COQ_GEN by construction. IDs are the live KVM4 fleet (verified
read-only); update via change control, never ad-hoc.
"""
from __future__ import annotations

AGENT_ROUTE_MAP: dict[str, str] = {
    "coa-ingestion":        "agent-ff02e492-3ada-4632-80d0-4168995c98ff",
    "parameter-extraction": "agent-4497fa65-9514-4ebd-a94a-e136a583521a",
    "coq-assembly":         "agent-0b5ea789-9194-42ce-b297-b4f47e0f76fa",
    "compliance":           "agent-cba66d7c-1153-4d23-b623-d06696a2b850",
    "specification-advisor":"agent-58fdfb99-f59c-4d1a-856f-00818994c544",
    "report-generation":    "agent-2eace634-159b-4615-bb6a-adeb3ed4c76d",
    "search-assistant":     "agent-0e00f03f-f18e-47a4-b002-be95523e1fad",
    "ecoa-qc":              "agent-6440b061-e0cd-48c0-9320-7b9b56431d49",
    "ocr-escalation":       "agent-733e50b0-9cde-4c3b-a333-6bd3e971b59b",
    "variation-f":          "agent-6904727a-299f-4907-b206-36a383bf8c21",
}

# Explicitly excluded (documented so reviewers see the intent): stock_trading_advisor,
# trend_detector, executive_summarizer, weekly_report_analyst, ars_*, equipment_manuals_agent.
