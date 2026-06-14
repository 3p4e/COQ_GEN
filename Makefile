# Planner — standalone developer tasks. Backend in server/ (.venv), frontend in web/.
.PHONY: venv install migrate seed api test test-sql lint web-install web build

VENV ?= .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
export PLANNER_DATABASE_URL ?= postgresql+psycopg://planner:planner@127.0.0.1:5432/planner_dev

venv:
	python3 -m venv $(VENV)

install: venv ## install the API (editable) + dev tools
	$(PIP) install -q -e "server[dev]"

migrate: ## apply the schema baseline (alembic upgrade head)
	cd server/db && $(abspath $(VENV))/bin/alembic upgrade head

seed: ## load the demo data (departments, users, a week of tasks, reports)
	PGPASSWORD=planner psql -h 127.0.0.1 -U planner -d planner_dev -v ON_ERROR_STOP=1 -f server/fixtures/seed_demo.sql

api: ## run the Planner API (localhost:8765)
	cd server && $(abspath $(PY)) -m planner_api.main

test: ## python unit tests
	cd server && $(abspath $(VENV))/bin/pytest -q tests

test-sql: ## SQL schema + smoke checks (needs local postgres)
	bash server/tests/run.sh

lint:
	$(VENV)/bin/ruff check server

web-install:
	cd web && npm install

web: ## run the web app (Vite dev, localhost:5174)
	cd web && npm run dev

build: ## type-check + build the web app
	cd web && npm run build
