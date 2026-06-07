"""baseline schema — applies the canonical db/schema.sql

Keeps db/schema.sql as the single source of truth for the data model; this migration
simply executes it. Later migrations are authored incrementally (forward-only in
validated environments).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-07
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
    # Split safely with sqlparse (a COMMENT literal in schema.sql contains ';'), and run
    # via the RAW psycopg3 cursor so literal '%' in comments isn't parsed as a placeholder
    # (which SQLAlchemy's exec_driver_sql would do). Same connection => same alembic tx.
    sql = SCHEMA_SQL.read_text(encoding="utf-8")
    raw = op.get_bind().connection.driver_connection
    with raw.cursor() as cur:
        for statement in sqlparse.split(sql):
            stmt = statement.strip()
            if stmt:
                cur.execute(stmt)


def downgrade() -> None:
    # Baseline is not reversible (full schema). Drop/recreate the database instead.
    raise NotImplementedError("baseline migration is not reversible")
