"""COQ_GEN Core API — local FastAPI sidecar (localhost-only).

Phase 0 scaffold: configuration, DB access, health, a read-only specs endpoint,
an ingest stub, and a Letta gateway client. Business logic (ingestion pipeline,
master-parameter resolver, COQ engine) lands in later phases per docs/07_ROADMAP.md.
"""

__version__ = "0.1.0"
