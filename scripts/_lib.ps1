Set-StrictMode -Version Latest

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}

function Write-Section([string]$Msg) {
  Write-Host ""
  Write-Host $Msg -ForegroundColor Cyan
}

function Sha256([string]$Path) {
  if (-not (Test-Path $Path)) { return "" }
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLower()
}
