"""Alembic environment — online migrations against PLANNER_DATABASE_URL (sync psycopg)."""
from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer the app's env var; fall back to alembic.ini.
DB_URL = os.environ.get("PLANNER_DATABASE_URL") or config.get_main_option("sqlalchemy.url")

# No ORM metadata yet (schema is managed by the canonical db/schema.sql baseline).
target_metadata = None


def run_migrations_offline() -> None:
    context.configure(url=DB_URL, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(DB_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
