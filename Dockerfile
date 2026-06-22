# ─────────────────────────────────────────────
# Stage 1: Base image
# ─────────────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev libffi-dev libssl-dev \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf-xlib-2.0-0 shared-mime-info curl \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────
# Stage 2: Install Python dependencies
# ─────────────────────────────────────────────
FROM base AS dependencies

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# ─────────────────────────────────────────────
# Stage 3: Development (hot-reload)
# ─────────────────────────────────────────────
FROM dependencies AS development

COPY . .
RUN mkdir -p /app/storage /app/logs

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]

# ─────────────────────────────────────────────
# Stage 4: Production (gunicorn + non-root)
# ─────────────────────────────────────────────
FROM dependencies AS production

RUN groupadd -r britledger && useradd -r -g britledger britledger

COPY . .
RUN mkdir -p /app/storage /app/logs && chown -R britledger:britledger /app

USER britledger

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "app.main:app", \
     "-w", "4", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
