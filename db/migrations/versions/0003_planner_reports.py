"""planner weekly reports + report embeddings

Idempotent, like 0002 — the 0001 baseline re-executes the current db/schema.sql
(which already contains these tables), so the IF NOT EXISTS guards make this a
no-op on a fresh DB and additive on a DB stamped before §7 reports were added.
Keep the DDL in sync with db/schema.sql §7.

Revision ID: 0003_planner_reports
Revises: 0002_planner
Create Date: 2026-06-13
"""
from __future__ import annotations

from alembic import op

revision = "0003_planner_reports"
down_revision = "0002_planner"
branch_labels = None
depends_on = None


UPGRADE_STATEMENTS: list[str] = [
    """
    CREATE TABLE IF NOT EXISTS planner_weekly_report (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id           UUID NOT NULL REFERENCES app_user(id),
        week_start        DATE NOT NULL,
        completed_summary TEXT,
        progress_summary  TEXT,
        next_week_plan    TEXT,
        status            TEXT NOT NULL DEFAULT 'draft',
        ai_generated      BOOLEAN NOT NULL DEFAULT FALSE,
        submitted_at      TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, week_start)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_report_week ON planner_weekly_report(week_start)",
    """
    CREATE TABLE IF NOT EXISTS planner_report_embedding (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id   UUID NOT NULL REFERENCES planner_weekly_report(id) ON DELETE CASCADE,
        chunk_text  TEXT NOT NULL,
        embedding   vector(1536),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_report_embed ON planner_report_embedding "
    "USING hnsw (embedding vector_cosine_ops)",
]

DOWNGRADE_STATEMENTS: list[str] = [
    "DROP TABLE IF EXISTS planner_report_embedding",
    "DROP TABLE IF EXISTS planner_weekly_report",
]


def upgrade() -> None:
    for stmt in UPGRADE_STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    for stmt in DOWNGRADE_STATEMENTS:
        op.execute(stmt)
