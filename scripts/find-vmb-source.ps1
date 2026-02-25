$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_lib.ps1"

Write-Section "== FIND VMB SOURCE TABLES under C:\dev =="

$need = @(
  "vmb_facilities.json",
  "vmb_licensees.json",
  "facilities.json",
  "licensees.json",
  "vmb_address_rollup.json",
  "vmb_attach_candidates.json",
  "vmb_licensees_attached.json"
)

$root = "C:\dev"
Write-Host "Searching $root for: $($need -join ', ')" -ForegroundColor DarkGray

$hits = @()

foreach ($name in $need) {
  $files = Get-ChildItem -Path $root -Recurse -File -Filter $name -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $hits += [pscustomobject]@{
      File = $f.Name
      FullName = $f.FullName
      Size = $f.Length
      Modified = $f.LastWriteTime
      Dir = $f.DirectoryName
    }
  }
}

if ($hits.Count -eq 0) {
  Write-Host "NO MATCHES FOUND. Upstream tables are not on disk under C:\dev." -ForegroundColor Red
  Write-Host "This means you must RESTORE the tables from backup OR re-run the DORA extractor that originally produced them." -ForegroundColor Yellow
  exit 1
}

$hits | Sort-Object File, Dir | Format-Table -AutoSize

Write-Host ""
Write-Host "TIP: pick the folder that contains BOTH vmb_facilities.json and vmb_licensees.json" -ForegroundColor Yellow
