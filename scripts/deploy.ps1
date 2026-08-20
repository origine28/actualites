<#
.SYNOPSIS
    Script de deploiement (squelette Phase 1 - a completer en Phases 10-11).
.DESCRIPTION
    Construit le projet et lance le backend en production via PM2.
    La configuration Cloudflared sera ajoutee en Phase 11.
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

if (-not $SkipBuild) {
    Write-Host "==> Build backend + frontend"
    Push-Location $Root
    try {
        npm run build
        if (-not $?) { throw "npm run build a echoue" }
    }
    finally {
        Pop-Location
    }
}

Write-Host "==> Lancement du backend via PM2"
Push-Location (Join-Path $Root 'backend')
try {
    $isPm2 = Get-Command pm2 -ErrorAction SilentlyContinue
    if (-not $isPm2) {
        Write-Host "PM2 non installe. Commande manuelle a la place :" -ForegroundColor Yellow
        Write-Host "  node dist/server.js"
    }
    else {
        pm2 start dist/server.js --name news-backend
        Write-Host "  Backend demarre. Service Windows (auto-start) a configurer en Phase 10."
    }
}
finally {
    Pop-Location
}

Write-Host "==> Etapes Cloudflared (Phase 11) :" -ForegroundColor Yellow
Write-Host "  - Creer le tunnel nomme pointant vers http://127.0.0.1:8080"
Write-Host "  - Installer le service : cloudflared service install"
Write-Host "  - Configurer les Cache Rules (contenu authentifie non mis en cache)"
Write-Host "`nDeploiement termine (squelette Phase 1)."
