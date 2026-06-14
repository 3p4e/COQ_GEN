# planner_api — FastAPI backend image (runs migrations then uvicorn).
FROM python:3.12-slim
WORKDIR /app

# postgresql-client provides pg_isready (startup wait) + psql (optional demo seed).
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY planner_api ./planner_api
COPY db ./db
COPY fixtures ./fixtures
RUN pip install --no-cache-dir .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8765
ENTRYPOINT ["docker-entrypoint.sh"]
