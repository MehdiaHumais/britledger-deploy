#!/usr/bin/env pwsh
# BritLedger AI - Local Development Start Script
# Run this from the project root: .\start.ps1

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  BritLedger AI - Starting Server" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python not found. Install Python 3.10+ first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found. Create it from .env.example" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "storage/uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "alembic/versions" | Out-Null

Write-Host "[1/3] Running database migrations..." -ForegroundColor Yellow
try {
    python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Migration failed. Continuing anyway..." -ForegroundColor Yellow
    } else {
        Write-Host "      Migrations OK" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] Could not run migrations: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/3] Starting FastAPI server..." -ForegroundColor Yellow
Write-Host "      URL:  http://localhost:8000" -ForegroundColor Green
Write-Host "      Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "[3/3] Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level info
