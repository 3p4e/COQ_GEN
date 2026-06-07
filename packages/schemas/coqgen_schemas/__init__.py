"""Shared Pydantic v2 contracts used by core_api (and codegen'd to TypeScript for the UI).

Keep these the single definition of the cross-boundary shapes. Generate TS types with:
    datamodel-codegen / openapi typescript from the core_api OpenAPI, or
    pydantic2ts against this module.
"""
from __future__ import annotations

from datetime import date
from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str = "ok"
    service: str
    version: str


class DbHealth(BaseModel):
    connected: bool
    server_version: str | None = None
    tables: int | None = None
    error: str | None = None


class SpecGrade(BaseModel):
    grade: str
    designation: str | None = None
    product_code: str | None = None
    thc_low: float | None = None
    thc_high: float | None = None
    cbd_max: float | None = None


class SpecParameter(BaseModel):
    display_order: int | None = None
    param_name: str
    method: str | None = None
    operator: str | None = None
    limit_low: float | None = None
    limit_high: float | None = None
    limit_text: str | None = None
    unit: str | None = None


class ProductSpec(BaseModel):
    spec_code: str
    version: str
    category: str = Field(description="IMG | IPM | FP | IMB")
    title: str
    dominance: str | None = Field(default=None, description="THC | CBD (strain-agnostic)")
    status: str = "active"
    effective_from: date | None = None
    parameters: list[SpecParameter] = []
    grades: list[SpecGrade] = []


class IngestAccepted(BaseModel):
    """Phase 0 stub response for an accepted ingest request."""
    received: int
    document_codes: list[str] = []
    note: str = "Phase 0 stub: OCR/parse/embed + agent extraction land in Phase 1-2."
