# Développement

## Phases

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Architecture + validation | ✅ validée |
| 1 | Initialisation projet (structure, build, tests, smoke) | ✅ terminée |
| 2 | Authentification (sessions, CSRF, rate limiting, bootstrap admin) | ✅ terminée |
| 3 | Utilisateurs + journaux de connexion | ✅ terminée |
| 4 | Articles + catégories + tags + recherche | ✅ terminée |
| 5 | Médias (images, vidéos externes) | ✅ terminée |
| 6 | Téléchargements (PDF, applications) | ✅ terminée |
| 7 | Contact (formulaire USER + modération ADMIN) | ✅ terminée |
| 8 | Durcissement sécurité (CSP, rate limiting global, CORS, audit étendu) | ✅ terminée |
| 9 | Tests complets + E2E | à venir |
| 10 | Build production + PM2 | à venir |
| 11 | Cloudflared | à venir |
| 12 | Tests production | à venir |

## Structure

```
actualites/
├── backend/    API Express + Prisma + storage/ + tests/
├── frontend/   SPA React/Vite + tests/
├── docs/       documentation
└── scripts/    scripts PowerShell
```

## Commandes

```powershell
npm run dev         # backend + frontend (parallèle)
npm run build       # compilation TS + build Vite
npm run test        # vitest backend + frontend
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test:e2e    # Playwright (backend + frontend + seed auto)
npm run test:e2e:ui # Playwright avec interface
```

## Backend

- Dev : `npm run dev` (tsx watch) dans `backend/`
- Routes : `backend/src/routes/` → contrôleurs → services → repositories → Prisma
- Validation d'environnement : `backend/src/config/env.ts` (Zod)
- Prisma : `npm run prisma:migrate`, `npm run prisma:generate`, `npm run db:check`

## Authentification (Phase 2)

- **Bootstrap** du premier administrateur (CLI locale, aucune route HTTP) :

  ```powershell
  cd backend
  npm run setup:admin   # invite : username, email, mot de passe (≥ 8, chiffre + majuscule)
  ```

- **Flux** : `GET /api/auth/csrf` → `POST /api/auth/login` (Set-Cookie `news.sid` httpOnly) → `GET /api/auth/me` → `POST /api/auth/logout`.
- **Mutations** : toute requête autre que GET/HEAD/OPTIONS doit envoyer l'en-tête `X-CSRF-Token` correspondant au cookie `news.csrf` (double-submit signé HMAC).
- **Sécurité** : Argon2id, verrouillage de compte après `LOGIN_MAX_ATTEMPTS` échecs, rate limiting IP sur `/login`, sessions révoquées à la désactivation, journalisation `login_logs` + `audit_logs`.
- **Tests E2E** : `playwright.config.ts` démarre backend (`dist/server.js`) + frontend (Vite), seed les comptes `e2e_admin` / `e2e_user` puis exécute les scénarios ADMIN/USER/refusé/invalide.
- Première utilisation : `npx playwright install chromium` (navigateur de test).

## Frontend

- Dev : `npm run dev` dans `frontend/` (Vite, port 5173)
- Le proxy Vite redirige `/api` → `http://127.0.0.1:8080` (voir `frontend/vite.config.ts`)
