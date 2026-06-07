#!/usr/bin/env bash
# Generate the shared TypeScript types the UI (Design agent) consumes — from the
# Core API's OpenAPI (which is derived from the Pydantic contracts in
# packages/schemas). Output: apps/desktop/src/types/api.d.ts (+ friendly models.ts).
# Run after changing any Pydantic schema or endpoint.  Usage: bash scripts/gen_types.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="${PY:-$ROOT/.venv/bin/python}"
OUT_DIR="$ROOT/apps/desktop/src/types"
OUT_JSON="$ROOT/apps/desktop/openapi.json"
mkdir -p "$OUT_DIR"

echo "==> dumping OpenAPI from coqgen_core.main:app"
"$PY" -c "import json; from coqgen_core.main import app; open('$OUT_JSON','w').write(json.dumps(app.openapi(), indent=2))"

echo "==> generating TypeScript (openapi-typescript)"
cd "$ROOT/apps/desktop"
npx --yes openapi-typescript "$OUT_JSON" -o "src/types/api.d.ts"
echo "==> wrote src/types/api.d.ts"
