<#
.SYNOPSIS
    Script d'installation du projet (squelette Phase 1).
.DESCRIPTION
    Vérifie l'environnement, installe les dépendances et prépare le backend.
    Certaines étapes seront complétées dans les phases suivantes
    (création de l'utilisateur PostgreSQL, prisma migrate, setup:admin).
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Verification de l'environnement" -ForegroundColor Cyan
$node = node --version
$npm = npm --version
Write-Host "Node : $node"
Write-Host "npm  : $npm"

Write-Host "`n==> Installation des dependances (racine)" -ForegroundColor Cyan
Push-Location $Root
try {
    npm install
    if (-not $?) { throw "npm install a echoue" }
}
finally {
    Pop-Location
}

Write-Host "`n==> Configuration du backend" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Root 'backend\.env'))) {
    Copy-Item (Join-Path $Root 'backend\.env.example') (Join-Path $Root 'backend\.env')
    Write-Host "backend\.env cree depuis .env.example - COMPLETEZ les valeurs (DATABASE_URL, secrets)." -ForegroundColor Yellow
}

Write-Host "`n==> Etapes manuelles restantes (phases suivantes) :" -ForegroundColor Yellow
Write-Host "  1. Creer l'utilisateur news_app et la base news_db (voir docs/database.md)."
Write-Host "  2. backend : npx prisma generate ; npx prisma migrate deploy."
Write-Host "  3. backend : npm run setup:admin (premier ADMIN, Phase 2)."
Write-Host "`nTermine."
