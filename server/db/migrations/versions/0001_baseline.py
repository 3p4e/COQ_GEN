"""baseline schema — applies the canonical server/db/schema.sql

Keeps schema.sql as the single source of truth for the data model; this migration
simply executes it. Later migrations are authored incrementally (forward-only).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-14
"""
from __future__ import annotations

from pathlib import Path

import sqlparse
from alembic import op

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

# db/migrations/versions/0001_baseline.py -> parents[2] == db/
SCHEMA_SQL = Path(__file__).resolve().parents[2] / "schema.sql"


def upgrade() -> None:
    # Split with sqlparse (a COMMENT literal may contain ';'), and run via the RAW psycopg3
    # cursor so a literal '%' isn't parsed as a placeholder. Same connection => same tx.
    sql = SCHEMA_SQL.read_text(encoding="utf-8")
    raw = op.get_bind().connection.driver_connection
    with raw.cursor() as cur:
        for statement in sqlparse.split(sql):
            stmt = statement.strip()
            if stmt:
                cur.execute(stmt)


def downgrade() -> None:
    raise NotImplementedError("baseline migration is not reversible")
