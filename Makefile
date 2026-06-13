# COQ_GEN developer tasks. Python services run in .venv; desktop in apps/desktop.
.PHONY: venv install setup db-smoke migrate seed seed-planner api gateway test test-sql \
        ui-install ui lint gen-types gen-types-planner planner-install planner

VENV ?= .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
export COQGEN_DATABASE_URL ?= postgresql+psycopg://coqgen:coqgen@127.0.0.1:5432/coqgen_dev

venv:
	python3 -m venv $(VENV)

install: venv
	$(PIP) install -q -r requirements-dev.txt
	$(PIP) install -q -e packages/schemas -e services/core_api -e services/gateway

setup: ## bootstrap db + schema + seed (needs local postgres)
	bash scripts/dev_setup.sh

migrate:
	cd db && $(abspath $(VENV))/bin/alembic upgrade head

seed:
	PGPASSWORD=coqgen psql -h 127.0.0.1 -U coqgen -d coqgen_dev -v ON_ERROR_STOP=1 -f tests/fixtures/seed_real_specs.sql

seed-planner: ## load the planner demo (departments, users, a week of tasks)
	PGPASSWORD=coqgen psql -h 127.0.0.1 -U coqgen -d coqgen_dev -v ON_ERROR_STOP=1 -f tests/fixtures/seed_planner_demo.sql

api: ## run the Core API sidecar (localhost:8765)
	$(PY) -m coqgen_core.main

gateway: ## run the Letta gateway (0.0.0.0:8800)
	$(VENV)/bin/uvicorn coqgen_gateway.main:app --host 0.0.0.0 --port 8800

test: ## python unit tests
	$(VENV)/bin/pytest -q services/core_api/tests

test-sql: ## SQL schema + smoke + OpenAPI checks (needs local postgres)
	bash tests/run.sh

lint:
	$(VENV)/bin/ruff check services packages

gen-types: ## regenerate apps/desktop/src/types/api.d.ts from the Core API OpenAPI
	PY=$(abspath $(PY)) bash scripts/gen_types.sh

gen-types-planner: ## regenerate apps/planner/src/types/api.d.ts from the Core API OpenAPI
	PY=$(abspath $(PY)) APP_DIR=apps/planner bash scripts/gen_types.sh

ui-install:
	cd apps/desktop && npm install

ui: ## run the desktop app (Tauri dev)
	cd apps/desktop && npm run tauri dev

planner-install:
	cd apps/planner && npm install

planner: ## run the planner app (Vite dev, localhost:5174)
	cd apps/planner && npm run dev
