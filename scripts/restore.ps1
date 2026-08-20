<#
.SYNOPSIS
    Script de restauration (squelette Phase 1 - a completer en Phase 12).
.DESCRIPTION
    Restaure la base PostgreSQL et le dossier storage/ a partir d'une sauvegarde.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,        # chemin du dump SQL
    [string]$StorageBackupDir   # dossier storage_* a restaurer (optionnel)
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $BackupFile)) { throw "Fichier de sauvegarde introuvable : $BackupFile" }

Write-Host "==> Restauration de la base : $BackupFile"
# psql --host 127.0.0.1 --username news_app --dbname news_db -f $BackupFile
Write-Host "  (a completer en Phase 12 - procede de restauration a tester avant production)" -ForegroundColor Yellow

if ($StorageBackupDir) {
    if (-not (Test-Path $StorageBackupDir)) { throw "Dossier storage a restaurer introuvable : $StorageBackupDir" }
    $target = Join-Path $Root 'backend\storage'
    Write-Host "==> Restauration du storage vers $target"
    Copy-Item -Recurse $StorageBackupDir $target
}

Write-Host "Restauration terminee."
