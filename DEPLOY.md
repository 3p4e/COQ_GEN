# Deploy — stand-alone planner + Letta AI

End-to-end deployment: PostgreSQL, the planner API, the React app, and the Letta gateway that
connects the planner to the DeepSeek agents on the Letta server. AI degrades gracefully, so steps
1–3 give a fully working planner; steps 4–5 turn the AI on.

## Full-stack (one command, recommended for KVM4)

Brings up **Postgres + planner_api + web + gateway** together. `web` is published on `:8080` and
reverse-proxies the API (same origin, no browser CORS); the gateway joins the Letta network.

```bash
# on the Letta host, from the repo:
PLANNER_JWT_SECRET=$(openssl rand -hex 32) LETTA_SERVER_PASSWORD=letta-master-key \
  docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:8080/health ; echo      # proxied to planner_api
```
Open `http://<host>:8080` and log in (`elena` / `Password123!`, etc.). First boot migrates + seeds
demo data (set `PLANNER_SEED=0` to skip).

- Set the external Letta network name in `docker-compose.yml` (`networks.letta.name`) to match
  `docker network ls` — it was `agent-zero-t4sx_default`.
- This compose **includes** the gateway. If you already ran `docker-compose.letta.yml`, remove that
  container first: `docker rm -f planner-gateway`.

The sections below are the equivalent **manual / piecemeal** steps (useful for local dev or debugging).

## 0. Prerequisites
- PostgreSQL 16 + pgvector.
- Python 3.11+ and Node 22 (for local runs) — or just Docker for the gateway.
- A self-hosted Letta server (this repo targets `http://letta:8283` inside the Letta Docker stack).

## 1. Database
```sql
CREATE ROLE planner LOGIN PASSWORD 'planner' CREATEDB;
CREATE DATABASE planner_dev OWNER planner;
```

## 2. Backend (planner_api)
```bash
make install          # venv + pip install -e "server[dev]"
make migrate          # alembic upgrade head (0001 baseline executes server/db/schema.sql)
make seed             # demo departments, users, a week of tasks + reports
make api              # http://127.0.0.1:8765  (OpenAPI at /docs)
```
Override defaults with `PLANNER_*` env (see `.env.example`); set `PLANNER_JWT_SECRET` in production.

## 3. Frontend (web)
```bash
make web-install && make web      # http://127.0.0.1:5174
```
Point it at the API with `VITE_PLANNER_API` if not on localhost:8765.

## 4. Letta agents (one-time; already provisioned on srv1231216)
Four stateful agents power the AI. They exist and run on DeepSeek:

| logical name | Letta agent id | model |
|---|---|---|
| weekly-report | `agent-c783d24a-9d85-4b0b-8882-e210f504504a` | `deepseek/deepseek-v4-flash` |
| task-rewrite | `agent-e8518fbc-29a2-4585-8ba8-7cb45a936a18` | `deepseek/deepseek-v4-flash` |
| next-week-plan | `agent-815929b3-8ffb-4671-992b-ee7d55273f24` | `deepseek/deepseek-v4-pro` |
| executive-analytics | `agent-e72faed9-38f8-4808-9dde-2fac12038f22` | `deepseek/deepseek-v4-pro` |

To (re)point a model, run on the Letta host (handles are provider-prefixed; bare names 404):
```bash
docker exec -i letta python3 - <<'PY'
import json, urllib.request
BASE, TOKEN = "http://localhost:8283", "letta-master-key"   # = LETTA_SERVER_PASSWORD
def patch(aid, handle):
    r = urllib.request.Request(f"{BASE}/v1/agents/{aid}", method="PATCH",
        data=json.dumps({"model": handle}).encode(),
        headers={"Authorization": "Bearer "+TOKEN, "Content-Type": "application/json"})
    print(aid, "->", json.load(urllib.request.urlopen(r)).get("llm_config", {}).get("model"))
patch("agent-c783d24a-9d85-4b0b-8882-e210f504504a", "deepseek/deepseek-v4-flash")
patch("agent-e8518fbc-29a2-4585-8ba8-7cb45a936a18", "deepseek/deepseek-v4-flash")
patch("agent-815929b3-8ffb-4671-992b-ee7d55273f24", "deepseek/deepseek-v4-pro")
patch("agent-e72faed9-38f8-4808-9dde-2fac12038f22", "deepseek/deepseek-v4-pro")
PY
```

## 5. Gateway container (turns the AI on)
Deploy the gateway into the Letta stack so it can reach `letta:8283`:
```bash
# from this repo on the Letta host:
LETTA_SERVER_PASSWORD=<your password> docker compose -f docker-compose.letta.yml up -d --build
docker logs planner-gateway        # expect uvicorn on :8800
curl -s http://127.0.0.1:8800/health
```
- Confirm the compose `networks:` name matches your Letta stack (`docker network ls`; often
  `letta_stack` or `letta_letta_stack`).
- Agent IDs default to the table above; override with `GATEWAY_AGENT_*` env if they change.

Then point the planner API at the gateway and restart it:
```bash
export PLANNER_GATEWAY_URL=http://127.0.0.1:8800
# (optional) PLANNER_GATEWAY_TOKEN if you front the gateway with auth
```

## 6. Verify AI end-to-end
- `GET http://127.0.0.1:8800/health` → `letta_configured: true`, four agents listed.
- In the app: **Reports → AI draft** fills the report; **submit** persists it into the executive
  agent's memory; **Executive → Run AI analysis** returns summary / highlights / risks / foresight.
- Quick API check (JWT from `/auth/login`):
  ```bash
  curl -s -X POST -H "Authorization: Bearer $TOK" \
    "http://127.0.0.1:8765/planner/reports/ai-draft?week_start=$(date -d 'monday' +%F)"
  ```

## Notes
- Without `PLANNER_GATEWAY_URL`, every AI endpoint returns `available: false` + a note (HTTP 200);
  the planner is fully usable.
- The gateway is the only allow-listed path to Letta; keep it internal (bound to 127.0.0.1).
