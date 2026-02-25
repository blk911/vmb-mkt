param(
  [Parameter(Mandatory=$true)][string]$SourceDir,
  [string]$DestDir = "data\co\dora\denver_metro\tables"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$src = (Resolve-Path $SourceDir).Path
$dst = Join-Path $repoRoot $DestDir

Write-Host "== import-vmb-tables.ps1 ==" -ForegroundColor Cyan
Write-Host "Source: $src"
Write-Host "Dest:   $dst"

if (-not (Test-Path $dst)) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
}

# Required files for the UI/API
$required = @(
  "vmb_address_rollup.json",
  "vmb_attach_candidates.json",
  "vmb_licensees_attached.json"
)

$copied = @()
$missing = @()

foreach ($f in $required) {
  $from = Join-Path $src $f
  $to = Join-Path $dst $f
  if (Test-Path $from) {
    Copy-Item -Force $from $to
    $copied += $to
  } else {
    $missing += $from
  }
}

Write-Host ""
Write-Host "Copied:" -ForegroundColor Green
if ($copied.Count -eq 0) { Write-Host "(none)" -ForegroundColor DarkGray }
else { $copied | ForEach-Object { Write-Host $_ } }

Write-Host ""
if ($missing.Count -gt 0) {
  Write-Host "Missing (not found in SourceDir):" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host $_ }
  exit 2
}

Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
