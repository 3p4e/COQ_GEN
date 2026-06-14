# Planner — weekly production planner (stand-alone)

A GrowFlow-style **weekly production task planner** with real JWT auth + RBAC, a weekly
reporting cadence, per-week telemetry, and an executive analytics dashboard powered by a
Letta agent layer (graceful when offline). Domain-flavored (cultivation / QC / QA),
bilingual **English / Македонски**.

This repository is **self-contained**: a FastAPI + PostgreSQL(+pgvector) backend (`server/`)
and a React + Vite frontend (`web/`). No external service is required to run it; the AI
features activate when a Letta gateway is configured.

## Layout

```
server/                 FastAPI API + PostgreSQL schema/migrations
  planner_api/          app: config, db, auth, audit, gateway client, routers, schemas
  db/                   canonical schema.sql + Alembic (0001 baseline executes it)
  fixtures/             seed_demo.sql
  tests/                pytest + SQL smoke harness
web/                    React + Vite app (port 5174), bilingual EN/MK
```

## Quick start

```bash
# 0. Postgres 16 + pgvector, with a role + database:
#    CREATE ROLE planner LOGIN PASSWORD 'planner' CREATEDB;
#    CREATE DATABASE planner_dev OWNER planner;

# 1. Backend
make install            # python -m venv .venv + pip install -e "server[dev]"
make migrate            # alembic upgrade head (0001 baseline executes server/db/schema.sql)
make seed               # demo departments, users, a week of tasks + reports
make api                # http://127.0.0.1:8765  (OpenAPI at /docs)

# 2. Frontend
make web-install
make web                # http://127.0.0.1:5174
```

Demo login (any user, password `Password123!`): `elena` (HOD · QC), `marko`, `dimitar`,
`viktor`, `victoria` (executive), `admin`.

## Configuration (env, prefix `PLANNER_`)

| Variable | Default | Purpose |
|---|---|---|
| `PLANNER_DATABASE_URL` | `postgresql+psycopg://planner:planner@127.0.0.1:5432/planner_dev` | DB DSN |
| `PLANNER_JWT_SECRET` | dev placeholder | **override in production** |
| `PLANNER_GATEWAY_URL` / `PLANNER_GATEWAY_TOKEN` | empty | Letta gateway; AI degrades gracefully when unset |
| `VITE_PLANNER_API` (web) | `http://127.0.0.1:8765` | API base URL |

## Features

- **Auth & RBAC** — JWT login; roles operator / hod / qa / qp / executive / admin; server-side gating.
- **Task board** — departments, tasks with subtasks / helpers / dependencies / progress notes /
  cross-department handoffs; My Week and Board (status columns); per-week telemetry.
- **Weekly reports** — AI-draft → human edit → submit (read-only after); roll-over of unfinished
  tasks; AI rewrite. Submissions + AI runs recorded in a hash-chained audit trail.
- **Executive dashboard** (executive/admin) — org-wide rollups + an AI analytics agent
  (summary / highlights / risks / foresight) over all submitted reports, with pgvector embeddings.

Every AI surface returns `available: false` + a note (HTTP 200) when the gateway is unset, so the
planner is fully usable offline. AI activates with the Letta agents `weekly-report`, `task-rewrite`,
`executive-analytics`, and an `/embed` endpoint.

## Tests

```bash
make test               # pytest (routing, auth, OpenAPI, AI graceful degradation)
make test-sql           # schema.sql + smoke.sql against a throwaway DB
make lint               # ruff
make build              # web type-check + build
```
