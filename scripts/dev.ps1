param([int]$Port = 3001)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

Write-Host "== dev.ps1: VMB-MKT dev on port $Port ==" -ForegroundColor Cyan

& "$PSScriptRoot\stop.ps1" -Port $Port

Write-Host "Starting Next dev server on port $Port..." -ForegroundColor Green
Set-Location (Resolve-Path "$PSScriptRoot\..")
npm run dev
