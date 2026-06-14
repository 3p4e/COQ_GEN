"""Planner API entry point (FastAPI)."""
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

from . import __version__
from .config import get_settings
from .routers import auth, health, reports, tasks
from .routers import exec as exec_router

app = FastAPI(
    title="Planner API",
    version=__version__,
    summary="Standalone weekly production planner: tasks, weekly reports, executive analytics.",
)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(reports.router)
app.include_router(exec_router.router)


def run() -> None:
    s = get_settings()
    uvicorn.run(app, host=s.bind_host, port=s.bind_port)


if __name__ == "__main__":
    run()
