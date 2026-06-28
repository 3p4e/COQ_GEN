#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Installs the toolchain so tests (pytest), linters (ruff), and the UI builds
# work out of the box: a Python venv with the editable services/packages, and
# npm deps for both front-end apps. A PostgreSQL + pgvector bootstrap is attempted
# best-effort so the SQL/Alembic checks can run too, but never fails the session.
#
# Idempotent and non-interactive. Web-only (no-op on local machines).
set -euo pipefail

# Only run in Claude Code's remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

echo "==> [1/4] Python venv + dependencies"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q -U pip
python -m pip install -q -r requirements-dev.txt
python -m pip install -q -e packages/schemas -e services/core_api -e services/gateway

# Persist the venv + dev defaults for the rest of the session.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export PATH=\"$ROOT/.venv/bin:\$PATH\""
    echo "export VIRTUAL_ENV=\"$ROOT/.venv\""
    echo "export COQGEN_DATABASE_URL=\"postgresql+psycopg://coqgen:coqgen@127.0.0.1:5432/coqgen_dev\""
    echo "export PGPASSWORD=\"coqgen\""
  } >> "$CLAUDE_ENV_FILE"
fi

echo "==> [2/4] npm deps — apps/desktop"
( cd apps/desktop && npm install --no-fund --no-audit )

echo "==> [3/4] npm deps — apps/planner"
( cd apps/planner && npm install --no-fund --no-audit )

echo "==> [4/4] PostgreSQL 16 + pgvector (best-effort; DB-backed SQL/Alembic checks)"
{
  # Ensure pgvector is available, then start the cluster and create the dev DB.
  if ! ls /usr/share/postgresql/*/extension/ 2>/dev/null | grep -q vector; then
    sudo apt-get install -y postgresql-16-pgvector >/dev/null 2>&1 || true
  fi
  if ! pg_lsclusters 2>/dev/null | grep -q online; then
    sudo pg_ctlcluster 16 main start >/dev/null 2>&1 || true
  fi
  if pg_isready -q 2>/dev/null; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1 || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='coqgen') THEN
    CREATE ROLE coqgen LOGIN PASSWORD 'coqgen' SUPERUSER;  -- dev only
  END IF;
END $$;
SQL
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='coqgen_dev'" 2>/dev/null \
      | grep -q 1 || sudo -u postgres createdb -O coqgen coqgen_dev >/dev/null 2>&1 || true
    ( cd db && alembic upgrade head ) >/dev/null 2>&1 || true
    echo "    postgres ready (coqgen_dev migrated)"
  else
    echo "    postgres unavailable — skipping DB bootstrap (pytest/ruff/UI builds still work)"
  fi
} || echo "    DB bootstrap skipped (non-fatal)"

echo "==> session-start hook complete"
