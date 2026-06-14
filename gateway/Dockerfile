# Planner Letta gateway — runs as a container inside the Letta stack on KVM4.
FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "httpx>=0.27" \
    "pydantic>=2.7" "pydantic-settings>=2.3"

COPY planner_gateway ./planner_gateway

EXPOSE 8800
CMD ["python", "-m", "planner_gateway.main"]
