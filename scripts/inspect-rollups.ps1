$ErrorActionPreference = "Stop"

$p = "C:\dev\vmb-mkt\data\co\dora\denver_metro\tables\vmb_address_rollup.json"
if (-not (Test-Path $p)) {
  Write-Host "Missing: $p" -ForegroundColor Red
  exit 1
}

$j = Get-Content $p -Raw | ConvertFrom-Json

Write-Host ("rows=" + $j.Count) -ForegroundColor Cyan
$withZip = @($j | Where-Object { $_.zip5 -and $_.zip5.Trim() -ne "" }).Count
$withReg = @($j | Where-Object { $_.primaryRegLicenseNumber -and $_.primaryRegLicenseNumber.Trim() -ne "" }).Count
$withDigits = @($j | Where-Object { $_.addressKey -match "\d" }).Count

Write-Host ("withZip=" + $withZip) -ForegroundColor Cyan
Write-Host ("withReg=" + $withReg) -ForegroundColor Cyan
Write-Host ("withDigitsInAddressKey=" + $withDigits) -ForegroundColor Cyan

Write-Host "`nSample rows w/ street digits:" -ForegroundColor Green
$j |
  Where-Object { $_.addressKey -match "\d" } |
  Select-Object -First 10 businessName,addressKey,city,zip5,primaryRegLicenseNumber |
  Format-Table -AutoSize
