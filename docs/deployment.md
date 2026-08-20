# Déploiement (Windows 10 natif)

Architecture cible (Phase 10+) :

```
Windows 10
├── Node.js 24 LTS
├── PostgreSQL
├── Backend Express (PM2, service auto-start)
├── Frontend build (frontend/dist, servi par le backend)
├── Cloudflared (service Windows)
└── Sauvegardes planifiées (pg_dump + storage/)
```

Pas de Docker en V1.

## Étapes (récapitulatif des phases à venir)

1. `npm run build` (backend + frontend).
2. Backend : `npm run prisma:deploy` (migrations), `npm run setup:admin`.
3. PM2 : `pm2 start backend/dist/server.js` puis installation du service Windows.
4. Cloudflared : tunnel nommé pointant vers `http://127.0.0.1:8080`.
5. Test des règles de cache Cloudflare (contenu authentifié non mis en cache).

## État Phase 1

Les scripts `scripts/deploy.ps1`, `scripts/setup.ps1`, `scripts/backup.ps1` et
`scripts/restore.ps1` sont des squelettes documentés ; leur implémentation
complète dépend des phases suivantes.
