"""Transactional, strictly-monotonic certificate numbering (QCSOP 012 v3 §6.9.1).

Per (cert_type, year): SELECT ... FOR UPDATE on cert_sequence, increment, format.
Must be called inside the issuing transaction so allocation + register write are atomic.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_PREFIX = {"CoQ": "CoQ-PP", "iCoA": "iCoA-PP", "eCoA": "eCoA-PP"}


async def peek_next(session: AsyncSession, cert_type: str, year: int) -> str:
    """Advisory next number WITHOUT incrementing (for preview)."""
    last = (
        await session.execute(
            text("SELECT last_value FROM cert_sequence WHERE cert_type=:c AND year=:y"),
            {"c": cert_type, "y": year},
        )
    ).scalar_one_or_none() or 0
    return f"{_PREFIX[cert_type]}-{year}-{(last + 1):04d}"


async def allocate(session: AsyncSession, cert_type: str, year: int) -> tuple[str, int]:
    """Allocate the next number (locks the counter row; creates it if absent)."""
    if cert_type not in _PREFIX:
        raise ValueError(f"unknown cert_type {cert_type!r}")
    await session.execute(
        text("INSERT INTO cert_sequence(cert_type,year,last_value) VALUES (:c,:y,0) "
             "ON CONFLICT (cert_type,year) DO NOTHING"),
        {"c": cert_type, "y": year},
    )
    await session.execute(
        text("SELECT last_value FROM cert_sequence WHERE cert_type=:c AND year=:y FOR UPDATE"),
        {"c": cert_type, "y": year},
    )
    seq = (
        await session.execute(
            text("UPDATE cert_sequence SET last_value = last_value + 1 "
                 "WHERE cert_type=:c AND year=:y RETURNING last_value"),
            {"c": cert_type, "y": year},
        )
    ).scalar_one()
    return f"{_PREFIX[cert_type]}-{year}-{seq:04d}", seq
