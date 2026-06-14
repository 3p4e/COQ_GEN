#!/usr/bin/env bash
# Planner SQL harness: apply schema.sql to a fresh DB and run the smoke checks.
#   1. server/db/schema.sql applies cleanly to PostgreSQL 16 + pgvector
#   2. server/tests/smoke.sql verifies the data-layer guarantees
# Usage:  PGUSER=postgres bash server/tests/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # = server/
DB="${PLANNER_TEST_DB:-planner_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)
if [[ -z "${PGUSER:-}" && "$(id -u)" == "0" ]]; then PSQL=(sudo -u postgres "${PSQL[@]}"); fi

echo "==> (re)create database '$DB' and apply schema"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"
"${PSQL[@]}" -d "$DB" -f "$ROOT/db/schema.sql" >/dev/null
echo "    schema applied OK"

echo "==> run smoke checks"
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/smoke.sql"

echo
echo "==> ALL SQL TESTS PASSED"
