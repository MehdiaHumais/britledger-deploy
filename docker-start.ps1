#!/usr/bin/env pwsh
# ============================================================
# BritLedger AI — Docker Compose V2 Start Script
# Uses modern: docker compose (with space, not hyphen)
# ============================================================

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  BritLedger AI — Docker Start" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# ── Check Docker ──────────────────────────────
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Docker Desktop from:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To install Docker on E drive (save C drive space):" -ForegroundColor Yellow
    Write-Host '  Start-Process "Docker Desktop Installer.exe" -ArgumentList "install","--installation-dir=E:\Docker" -Wait' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# ── Check Docker Compose V2 ───────────────────
$composeVersion = docker compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Compose V2 not found." -ForegroundColor Red
    Write-Host "Update Docker Desktop to the latest version." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] $composeVersion" -ForegroundColor Green

# ── Check .env ────────────────────────────────
if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file missing!" -ForegroundColor Red
    Write-Host "Run: Copy-Item .env.example .env" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] .env found" -ForegroundColor Green

# ── Create directories ────────────────────────
New-Item -ItemType Directory -Force -Path "storage/uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "alembic/versions" | Out-Null
New-Item -ItemType Directory -Force -Path "nginx/ssl" | Out-Null
Write-Host "[OK] Directories created" -ForegroundColor Green
Write-Host ""

# ── Build & Start ─────────────────────────────
Write-Host "Building and starting all services..." -ForegroundColor Yellow
Write-Host "(First run may take 3-5 minutes to download images)" -ForegroundColor Gray
Write-Host ""

docker compose up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Failed to start services." -ForegroundColor Red
    Write-Host "Check logs with: docker compose logs" -ForegroundColor Yellow
    exit 1
}

# ── Wait for DB ───────────────────────────────
Write-Host ""
Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$retries = 0
do {
    Start-Sleep -Seconds 3
    $pgReady = docker compose exec -T postgres pg_isready 2>&1
    $retries++
} while ($LASTEXITCODE -ne 0 -and $retries -lt 10)

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] PostgreSQL may not be ready yet. Trying migrations anyway..." -ForegroundColor Yellow
} else {
    Write-Host "[OK] PostgreSQL is ready" -ForegroundColor Green
}

# ── Run Migrations ────────────────────────────
Write-Host ""
Write-Host "Running database migrations..." -ForegroundColor Yellow
docker compose exec api alembic upgrade head

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Migrations failed. Retrying in 5s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    docker compose exec api alembic upgrade head
}

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "   BritLedger AI is RUNNING!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  API:       http://localhost:8000"      -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:8000/docs"  -ForegroundColor Cyan
Write-Host "  Flower:    http://localhost:5555"       -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Gray
Write-Host "  docker compose logs -f api       # Live API logs"  -ForegroundColor Gray
Write-Host "  docker compose ps                # Service status" -ForegroundColor Gray
Write-Host "  docker compose down              # Stop everything" -ForegroundColor Gray
Write-Host "  docker compose down -v           # Stop + delete data" -ForegroundColor Gray
Write-Host ""
