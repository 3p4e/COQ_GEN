#!/usr/bin/env bash
# COQ_GEN test harness — validates the foundational artifacts that exist today:
#   1. db/schema.sql applies cleanly to a real PostgreSQL + pgvector
#   2. tests/smoke.sql verifies the data-layer guarantees (numbering, source
#      mapping, cross-lingual synonyms, release guard, audit hash chain)
#   3. api/gateway_openapi.yaml is a valid OpenAPI 3.1 spec
#
# Prereqs (Debian/Ubuntu): a running PostgreSQL 16 cluster + pgvector:
#   sudo apt-get install -y postgresql-16 postgresql-16-pgvector
#   sudo pg_ctlcluster 16 main start
# Usage:  PGUSER=postgres bash tests/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${COQGEN_TEST_DB:-coqgen_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)
# default to the postgres superuser if PGUSER not set and we are root
if [[ -z "${PGUSER:-}" && "$(id -u)" == "0" ]]; then PSQL=(sudo -u postgres "${PSQL[@]}"); fi

echo "==> [1/3] (re)create database '$DB' and apply schema"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB;" -c "CREATE DATABASE $DB;"
"${PSQL[@]}" -d "$DB" -f "$ROOT/db/schema.sql" >/dev/null
echo "    schema applied OK"

echo "==> [2/3] run smoke checks"
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/smoke.sql"

echo "==> [3/3] validate OpenAPI contract"
python3 "$ROOT/tests/validate_openapi.py"

echo
echo "==> ALL TESTS PASSED"
