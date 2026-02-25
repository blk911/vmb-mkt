$ErrorActionPreference = "Stop"

Write-Host "== VMB-MKT: materialize DORA CSV -> tables JSON ==" -ForegroundColor Cyan
$repoRoot = (Resolve-Path ".").Path
 $repo = $repoRoot
Write-Host "Repo: $repo" -ForegroundColor Gray

# Validate expected source folder exists
$src = Join-Path $repoRoot "data\co\dora\denver_metro\source"
if (!(Test-Path $src)) {
  Write-Host "Missing source dir: $src" -ForegroundColor Red
  Write-Host "Expected CSVs under data/co/dora/denver_metro/source" -ForegroundColor Yellow
  exit 1
}

Write-Host "Source dir: $src" -ForegroundColor Green
Write-Host "Running node materializer..." -ForegroundColor Cyan

$dst = Join-Path $repoRoot "data\co\dora\denver_metro\tables"
$tool = Join-Path $repoRoot "scripts\materialize\vmb-materialize.js"

node $tool --sourceDir $src --outDir $dst
if ($LASTEXITCODE -ne 0) {
  Write-Host "Materialize FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
  exit $LASTEXITCODE
}

$dst = Join-Path $repoRoot "data\co\dora\denver_metro\tables"
Write-Host "== Output tables ==" -ForegroundColor Cyan
Get-ChildItem $dst -ErrorAction SilentlyContinue |
  Where-Object { -not $_.PSIsContainer } |
  Sort-Object Name |
  Select-Object Name,Length,LastWriteTime |
  Format-Table -AutoSize

Write-Host "OK: materialize complete." -ForegroundColor Green
