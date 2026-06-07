#!/usr/bin/env bash
# One-shot local dev bootstrap for the Python services:
#   - ensure PostgreSQL 16 + pgvector running
#   - create the dev role + database
#   - apply the Alembic baseline (db/schema.sql) and load the real spec fixtures
# Usage:  bash scripts/dev_setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> ensure PostgreSQL cluster is up + pgvector installed"
if ! pg_lsclusters 2>/dev/null | grep -q online; then
  sudo pg_ctlcluster 16 main start || true
fi
ls /usr/share/postgresql/16/extension/ 2>/dev/null | grep -q vector \
  || sudo apt-get install -y postgresql-16-pgvector

echo "==> create dev role 'coqgen' + database 'coqgen_dev'"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='coqgen') THEN
    CREATE ROLE coqgen LOGIN PASSWORD 'coqgen' SUPERUSER;  -- dev only
  END IF;
END $$;
SELECT 'db exists' FROM pg_database WHERE datname='coqgen_dev' \gset
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='coqgen_dev'" | grep -q 1 \
  || sudo -u postgres createdb -O coqgen coqgen_dev

export COQGEN_DATABASE_URL="postgresql+psycopg://coqgen:coqgen@127.0.0.1:5432/coqgen_dev"

echo "==> alembic upgrade head (applies db/schema.sql baseline)"
( cd "$ROOT/db" && alembic upgrade head )

echo "==> load real spec fixtures"
PGPASSWORD=coqgen psql -h 127.0.0.1 -U coqgen -d coqgen_dev -v ON_ERROR_STOP=1 -q \
  -f "$ROOT/tests/fixtures/seed_real_specs.sql"

echo "==> done. Start the API with:  make api"
