# Ejecutar 043 en InsForge paso a paso (sin BEGIN/COMMIT)
# Uso: powershell -File db/migrations/043_apply/RUN.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$files = Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.sql' |
  Where-Object { $_.Name -ne '00_rollback.sql' } |
  Sort-Object Name

foreach ($f in $files) {
  Write-Host ">>> $($f.Name)" -ForegroundColor Cyan
  $sql = [IO.File]::ReadAllText($f.FullName)
  $out = & npx @insforge/cli db query $sql 2>&1
  $out | Write-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED $($f.Name)" -ForegroundColor Red
    exit 1
  }
  Write-Host "OK $($f.Name)" -ForegroundColor Green
}

Write-Host '043 apply complete' -ForegroundColor Green
