"""planner module — departments, tasks and the app_user authn columns

Idempotent by design. The 0001 baseline executes the *current* db/schema.sql, which
already contains §7 (planner) and the extra app_user columns. So on a fresh database
these objects exist by the time 0002 runs; the IF NOT EXISTS / catalog guards make
this migration a no-op there. On a database stamped at 0001 *before* §7 was added,
the same statements create the objects. Keep the DDL in sync with db/schema.sql §7.

Revision ID: 0002_planner
Revises: 0001_baseline
Create Date: 2026-06-13
"""
from __future__ import annotations

from alembic import op

revision = "0002_planner"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


# Each entry is a single SQL statement (run one-by-one so multi-statement / $$ blocks
# never hit DBAPI parameter parsing). Mirrors db/schema.sql §7.
UPGRADE_STATEMENTS: list[str] = [
    # --- planner_department -------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS planner_department (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key             TEXT NOT NULL UNIQUE,
        name_en         TEXT NOT NULL,
        name_mk         TEXT NOT NULL,
        icon            TEXT,
        color           TEXT,
        handoff_to_id   UUID REFERENCES planner_department(id),
        position        INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    # --- app_user authn / identity columns ----------------------------------
    "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS password_hash TEXT",
    "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS email TEXT",
    "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_url TEXT",
    "ALTER TABLE app_user ADD COLUMN IF NOT EXISTS dept_id UUID",
    # email UNIQUE (named to match the inline constraint produced by schema.sql)
    """
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_user_email_key') THEN
            ALTER TABLE app_user ADD CONSTRAINT app_user_email_key UNIQUE (email);
        END IF;
    END $$
    """,
    # dept_id -> planner_department
    """
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_appuser_dept') THEN
            ALTER TABLE app_user
                ADD CONSTRAINT fk_appuser_dept FOREIGN KEY (dept_id) REFERENCES planner_department(id);
        END IF;
    END $$
    """,
    # --- planner_task -------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS planner_task (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        department_id   UUID NOT NULL REFERENCES planner_department(id),
        title           TEXT NOT NULL,
        owner_id        UUID REFERENCES app_user(id),
        status          TEXT NOT NULL DEFAULT 'pending',
        priority        TEXT NOT NULL DEFAULT 'medium',
        week_start      DATE NOT NULL,
        days            TEXT[] NOT NULL DEFAULT '{}',
        room            TEXT,
        batch           TEXT,
        tags            TEXT[] NOT NULL DEFAULT '{}',
        description     TEXT,
        blocker         TEXT,
        created_by      UUID REFERENCES app_user(id),
        position        INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at    TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_task_dept   ON planner_task(department_id)",
    "CREATE INDEX IF NOT EXISTS idx_planner_task_owner  ON planner_task(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_planner_task_week   ON planner_task(week_start)",
    "CREATE INDEX IF NOT EXISTS idx_planner_task_status ON planner_task(status)",
    # --- task children ------------------------------------------------------
    """
    CREATE TABLE IF NOT EXISTS planner_task_helper (
        task_id  UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        user_id  UUID NOT NULL REFERENCES app_user(id),
        PRIMARY KEY (task_id, user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS planner_subtask (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id   UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        text      TEXT NOT NULL,
        done      BOOLEAN NOT NULL DEFAULT FALSE,
        position  INTEGER NOT NULL DEFAULT 0
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_subtask_task ON planner_subtask(task_id)",
    """
    CREATE TABLE IF NOT EXISTS planner_progress_note (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        day        TEXT,
        note       TEXT NOT NULL,
        author_id  UUID REFERENCES app_user(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_note_task ON planner_progress_note(task_id)",
    """
    CREATE TABLE IF NOT EXISTS planner_task_dependency (
        task_id            UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        depends_on_task_id UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, depends_on_task_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS planner_handoff (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id          UUID NOT NULL REFERENCES planner_task(id) ON DELETE CASCADE,
        to_department_id UUID NOT NULL REFERENCES planner_department(id),
        status           TEXT NOT NULL DEFAULT 'requested',
        requested_by     UUID REFERENCES app_user(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_planner_handoff_task ON planner_handoff(task_id)",
]

DOWNGRADE_STATEMENTS: list[str] = [
    "DROP TABLE IF EXISTS planner_handoff",
    "DROP TABLE IF EXISTS planner_task_dependency",
    "DROP TABLE IF EXISTS planner_progress_note",
    "DROP TABLE IF EXISTS planner_subtask",
    "DROP TABLE IF EXISTS planner_task_helper",
    "DROP TABLE IF EXISTS planner_task",
    "ALTER TABLE app_user DROP CONSTRAINT IF EXISTS fk_appuser_dept",
    "DROP TABLE IF EXISTS planner_department",
    "ALTER TABLE app_user DROP COLUMN IF EXISTS dept_id",
    "ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_email_key",
    "ALTER TABLE app_user DROP COLUMN IF EXISTS avatar_url",
    "ALTER TABLE app_user DROP COLUMN IF EXISTS email",
    "ALTER TABLE app_user DROP COLUMN IF EXISTS password_hash",
]


def upgrade() -> None:
    for stmt in UPGRADE_STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    for stmt in DOWNGRADE_STATEMENTS:
        op.execute(stmt)
