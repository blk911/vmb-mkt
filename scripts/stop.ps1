param([int]$Port = 3001)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "== stop.ps1: stopping anything on port $Port ==" -ForegroundColor Cyan

# Get connections if any (do not throw)
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host "No listener found on port $Port" -ForegroundColor DarkGray
  Write-Host "Done." -ForegroundColor Green
  exit 0
}

foreach ($c in $conns) {
  $procId = $c.OwningProcess
  if (-not $procId) { continue }

  $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($p) {
    Write-Host "Killing PID $procId ($($p.ProcessName)) on $Port" -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  } else {
    Write-Host "Killing PID $procId on $Port" -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Done." -ForegroundColor Green
