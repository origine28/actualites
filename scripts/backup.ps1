<#
.SYNOPSIS
    Script de sauvegarde (squelette Phase 1 - a completer en Phase 12).
.DESCRIPTION
    Sauvegarde la base PostgreSQL (pg_dump) et le dossier storage/.
#>
[CmdletBinding()]
param(
    [string]$BackupDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'backup')
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd_HHmmss'

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# 1. Base de donnees (valeurs par defaut a adapter / lire depuis backend/.env)
$dbUrl = $env:DATABASE_URL
if (-not $dbUrl) {
    Write-Host "DATABASE_URL non definie dans l'environnement - sauvegarde DB ignoree." -ForegroundColor Yellow
}
else {
    $dumpFile = Join-Path $BackupDir "news_db_$Stamp.sql"
    # Parse de l'URL : postgresql://user:pass@host:port/db
    Write-Host "Sauvegarde de la base : $dumpFile"
    # pg_dump --host 127.0.0.1 --username news_app --dbname news_db --format=plain --file=$dumpFile
    Write-Host "  (a completer en Phase 12)" -ForegroundColor Yellow
}

# 2. Stockage
$storage = Join-Path $Root 'backend\storage'
if (Test-Path $storage) {
    $dest = Join-Path $BackupDir "storage_$Stamp"
    Copy-Item -Recurse $storage $dest
    Write-Host "Storage sauvegarde : $dest"
}
else {
    Write-Host "Dossier storage absent, ignore." -ForegroundColor Yellow
}

Write-Host "Sauvegarde terminee."
