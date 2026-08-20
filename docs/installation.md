# Installation (Windows 10)

## Prérequis

- **Windows 10** (22H2)
- **Node.js 24 LTS** (installateur MSI : https://nodejs.org)
- **PostgreSQL** (installateur natif)
- **Git**

## Environnement actuel (versions figées)

| Composant | Version réelle |
|---|---|
| OS | Windows 10 22H2 |
| Node.js | 24.18.1 |
| npm | 11.16.0 |
| Git | 2.55.0.windows.3 |
| PostgreSQL | **17.10** (service `postgresql-x64-17`) |
| Express | 5 |
| Prisma | 7 |
| React | 19 |
| Vite | 8 |
| TypeScript | 6 |
| Tailwind CSS | 4 |
| Vitest | 4 |

Environnement actuel : **PostgreSQL 17.10 sous Windows 10. Compatible avec l'architecture PostgreSQL retenue.**

## Vérification

```powershell
node --version   # >= 24.x
npm --version
git --version
```

## Installation du projet

```powershell
cd projets\web\actualites
npm install
```

## Configuration backend

```powershell
cd backend
Copy-Item .env.example .env
# Éditer .env : DATABASE_URL (mot de passe réel), SESSION_SECRET, CSRF_SECRET
npx prisma generate
npx prisma migrate dev
cd ..
```

Création du premier administrateur (à partir de la Phase 2) :

```powershell
cd backend
npm run setup:admin
cd ..
```

## Lancement

```powershell
npm run dev        # backend (8080) + frontend (5173)
```

## Déploiement en production

Voir `docs/deployment.md` et `docs/cloudflared.md`.
