# apps/planner — Team Planner (GrowFlow)

A weekly production task planner with role-based access (JWT) and — in later
milestones — weekly AI reporting and an executive analytics dashboard. Domain-flavored
(cultivation / QC / QA), bilingual (English / Македонски). Reuses the Variation F design
system from `apps/desktop` and the existing `core_api` + Postgres backend.

## Run

```bash
# 1. Backend (from repo root): DB schema + migrations, planner demo seed, API
make setup            # alembic upgrade head (0001 baseline + 0002 planner)
make seed-planner     # departments, demo users, a week of tasks
make api              # FastAPI on http://127.0.0.1:8765

# 2. Frontend
make planner-install
make planner          # Vite dev server on http://127.0.0.1:5174
```

Demo login (any user, password `Password123!`): `elena` (HOD · QC), `marko`,
`dimitar`, `viktor`, `victoria` (executive), `admin`.

## Build / typecheck

```bash
npm run build         # tsc && vite build  (what CI runs)
```

## Layout

- `src/api/` — JWT-aware client (`client.ts`) + typed endpoint wrappers (`planner.ts`).
- `src/components/`, `src/styles/` — copied from `apps/desktop` (Variation F tokens + shared components).
- `src/i18n.ts` — EN/MK dictionary + day labels.
- `src/PlannerShell.tsx` — sidebar nav + week strip + language toggle.
- `src/views/` — `MyWeekView`, `BoardView`, `TaskCard`, `AddTaskModal`, `TelemetryBar`,
  `Login`, `ComingSoon` (reports/executive placeholders), `status.ts` (badge + week helpers).

## What's implemented (PR-A)

Login, My Week, Board (status columns), task CRUD with subtasks / helpers / dependencies /
progress notes / handoffs, per-week telemetry, bilingual UI. Weekly reporting + AI (PR-B) and
the executive analytics dashboard (PR-C) follow.
