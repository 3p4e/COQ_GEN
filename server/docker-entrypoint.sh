#!/usr/bin/env sh
# Wait for Postgres, apply the schema baseline, optionally seed demo data, then serve.
set -e

echo "==> waiting for postgres at ${PGHOST:-db}:5432"
until pg_isready -h "${PGHOST:-db}" -U "${PGUSER:-planner}" >/dev/null 2>&1; do
  sleep 2
done

echo "==> alembic upgrade head"
( cd /app/db && alembic upgrade head )

if [ "${PLANNER_SEED:-0}" = "1" ]; then
  echo "==> seeding demo data (idempotent)"
  PGPASSWORD="${PGPASSWORD:-planner}" psql -h "${PGHOST:-db}" -U "${PGUSER:-planner}" \
    -d "${PGDATABASE:-planner_dev}" -v ON_ERROR_STOP=1 -f /app/fixtures/seed_demo.sql || true
fi

echo "==> starting planner_api"
exec python -m planner_api.main
