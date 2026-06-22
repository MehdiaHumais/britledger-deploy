#!/usr/bin/env pwsh
# BritLedger AI — Stop all Docker services
param(
    [switch]$DeleteData  # Pass -DeleteData to also wipe the database volumes
)

Write-Host ""
Write-Host "Stopping BritLedger AI..." -ForegroundColor Yellow

if ($DeleteData) {
    Write-Host "[WARN] Deleting all data volumes (database will be wiped)!" -ForegroundColor Red
    docker compose down -v
} else {
    docker compose down
}

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
if (-not $DeleteData) {
    Write-Host "Data is preserved. Run .\docker-start.ps1 to restart." -ForegroundColor Gray
}
Write-Host ""
