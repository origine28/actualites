# Plateforme d'actualites, telechargements et administration

Projet developpe dans `projets/web/actualites/` via opencode.

- **Frontend** : React 19 + Vite 8 + TypeScript 6 + Tailwind CSS 4 (SPA, meme origine que l'API)
- **Backend** : Node.js 24 + Express 5 + TypeScript 6 + Prisma 7
- **Base de donnees** : PostgreSQL 17.10
- **Deploiement** : Windows 10 natif + PM2 + Cloudflared

## V0.1 — DEMO

**Statut** : Terminee

### Pre-requis

- Windows 10
- Node.js >= 24.0.0
- PostgreSQL 17.10
- Git

### Installation et demarrage

```powershell
# 1. Installer les dependances
cd projets/web/actualites
npm install

# 2. Configurer le backend
Copy-Item backend\.env.example backend\.env
# Editer backend\.env (DATABASE_URL, SESSION_SECRET, CSRF_SECRET)

# 3. Appliquer les migrations
npm run prisma:deploy --workspace @news/backend

# 4. Peupler les donnees de demo
npm run seed:demo --workspace @news/backend

# 5. Demarrer
npm run dev
```

### URLs

| Service | URL |
|---|---|
| Frontend | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:8080 |
| Health check | http://127.0.0.1:8080/api/health |

### Comptes de demonstration

| Role | Username | Mot de passe |
|---|---|---|
| USER | demo_user | DemoUser1! |
| ADMIN | demo_admin | DemoAdmin1! |

### Fonctionnalites disponibles

- Authentification (login, logout, sessions, CSRF, roles)
- Articles (liste publique, detail par slug, admin CRUD, publication/archivage)
- Categories (hierarchie, admin CRUD)
- Tags (admin CRUD, association aux articles)
- Medias (images upload + variants, videos YouTube/Vimeo)
- Telechargements (PDF, mobiles, desktops, admin CRUD)
- Contact (formulaire USER, moderation ADMIN)
- Administration (utilisateurs, articles, categories, tags, medias, telechargements, contacts)
- Securite (Argon2id, sessions, CSRF, CSP, rate limiting, audit)

### Limitations

- Pas de stockage R2 (fichiers sur disque local)
- Pas de rich text editor (contenu HTML en brut)
- Pas de CAPTCHA
- Limite 100 Mo par fichier
- Quick Tunnel temporaire (URL change a chaque relance)

### Documentation

- Guide de demo : [docs/demo-v0.1.md](docs/demo-v0.1.md)
- Rapport de validation : [docs/rapports/v0.1-demo.md](docs/rapports/v0.1-demo.md)

## Statut des phases

- [x] Phase 1 — Initialisation du projet
- [x] Phase 2 — Authentification
- [x] Phase 3 — Utilisateurs + journaux de connexion
- [x] Phase 4 — Articles + categories + tags
- [x] Phase 5 — Medias (images, videos)
- [x] Phase 6 — Telechargements (PDF, applications mobiles/desktops)
- [x] Phase 7 — Contact (formulaire USER + moderation ADMIN)
- [x] Phase 8 — Durcissement securite (CSP, rate limiting, CORS, audit)
- [ ] Phases 9-12 — Tests complets E2E, production (a venir)

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Backend + frontend en parallele |
| `npm run build` | Compile backend et frontend |
| `npm run test` | Tests backend + frontend |
| `npm run test:e2e` | Playwright E2E |
| `npm run lint` | ESLint backend + frontend |
| `npm run typecheck` | TypeScript strict backend + frontend |
| `npm run seed:demo --workspace @news/backend` | Donnees de demonstration |
| `npm run seed:e2e --workspace @news/backend` | Donnees E2E (Playwright) |
| `npm run setup:admin --workspace @news/backend` | Bootstrap premier admin |

## Documentation

Voir le dossier [docs/](docs/) : architecture, installation, developpement, base de donnees, securite, deploiement, cloudflared, sauvegarde, demo V0.1.
