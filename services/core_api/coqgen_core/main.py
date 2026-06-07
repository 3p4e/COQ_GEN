"""COQ_GEN Core API entry point (localhost-only FastAPI sidecar)."""
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from . import __version__
from .config import get_settings
from .routers import batches, catalog, dashboard, health, ingest, register, specs, templates

app = FastAPI(
    title="COQ_GEN Core API",
    version=__version__,
    summary="Local sidecar: orchestration, DB access, COQ engine (Phase 0 scaffold).",
)
app.include_router(health.router)
app.include_router(specs.router)
app.include_router(ingest.router)
app.include_router(dashboard.router)
app.include_router(batches.router)
app.include_router(register.router)
app.include_router(templates.router)
app.include_router(catalog.router)


def run() -> None:
    s = get_settings()
    # Bind localhost ONLY — never exposed on the network.
    uvicorn.run(app, host=s.bind_host, port=s.bind_port)


if __name__ == "__main__":
    run()
