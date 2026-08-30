# Architecture — Plateforme d'actualités

Architecture **définitivement validée** (Phase 0). Ce document est la référence.

## Stack (validée)

| Couche | Choix |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS + TanStack Query + Zustand |
| Backend | Node.js 24 LTS + Express 5 + TypeScript |
| Base de données | PostgreSQL |
| ORM | Prisma 7 (générateur `prisma-client`, driver adapter `@prisma/adapter-pg`) |
| Validation | Zod |
| Authentification | Sessions serveur + cookie httpOnly + Argon2id + CSRF + rate limiting |
| Tests | Vitest + Supertest (backend) · Testing Library (frontend) · Playwright (e2e) |
| Process manager | PM2 |
| Tunnel | Cloudflared (tunnel nommé) |
| Déploiement | Windows 10 natif, sans Docker |

## Versions réellement utilisées (figées)

`package-lock.json` est la référence reproductible ; aucune mise à jour automatique de dépendances.

| Composant | Version réelle |
|---|---|
| OS | Windows 10 22H2 |
| Node.js | 24.18.1 |
| npm | 11.16.0 |
| Git | 2.55.0.windows.3 |
| PostgreSQL | 17.10 (service `postgresql-x64-17`) |
| Express | 5 |
| Prisma | 7 (config `prisma.config.ts`, adapter `@prisma/adapter-pg`, client généré dans `src/generated/prisma`, ESM) |
| React | 19 |
| Vite | 8 |
| TypeScript | 6 |
| Tailwind CSS | 4 |
| Vitest | 4 |

Environnement actuel : **PostgreSQL 17.10 sous Windows 10. Compatible avec l'architecture PostgreSQL retenue.**

## Architecture globale

```
Internet
   ↓
Cloudflare (HTTPS, cache, CF-Connecting-IP)
   ↓
Cloudflare Tunnel → cloudflared (Windows)
   ↓
127.0.0.1:8080 → Express
   ↓
PostgreSQL + storage/
```

Frontend SPA + API servis **sur la même origine** (ex. `https://news.example.com`).
En production le backend sert les fichiers statiques du frontend (`frontend/dist`) et l'API `/api/*`.

## Décisions clés

- Site **entièrement authentifié** ; `/login` est le point d'entrée ; aucune inscription publique ; seules exceptions : `GET /api/health`.
- Deux rôles : `ADMIN` et `USER` ; création des comptes par l'ADMIN uniquement ; plusieurs admins possibles.
- Bootstrap initial : `npm run setup:admin` (CLI locale, aucune route HTTP).
- Désactivation = méthode normale (sessions révoquées, login refusé) ; soft delete ; pas de suppression définitive en V1.
- Reset de mot de passe par l'ADMIN uniquement en V1.
- Contenu : articles `DRAFT`/`PUBLISHED`/`ARCHIVED`, publication programmée (`PUBLISHED AND published_at <= NOW()`), catégories, tags, recherche PostgreSQL full-text.
- Médias : vidéos **externes** en V1 (provider validé), images stockées localement.
- Téléchargements : modèles relationnels (`download_categories` + `type` + `platform`), SHA-256 stocké, servis uniquement via API authentifiée.
- Cloudflare : **contenu authentifié = jamais de cache partagé** (`Cache-Control: private, no-store`) ; seuls les assets statiques hashés sont mis en cache.
- IP : `CF-Connecting-IP` (jamais les headers du navigateur). Port source : capture le port de la socket vue par l'app ; derrière le tunnel, c'est l'extrémité locale du tunnel (éphémère, non fiable pour identifier un client) — jamais un port inventé.
- Tailles V1 : images 5 Mo, PDF 50 Mo, applications 100 Mo (limite applicative compatible Cloudflare Free/Pro, configurable). Fichiers >100 Mo : évolution future vers R2/upload direct (hors V1).

## Modèle de données (conceptuel)

`users`, `sessions`, `login_logs`, `audit_logs`, `categories`, `tags`, `article_tags`,
`articles`, `images`, `article_images`, `videos`, `download_categories`, `downloads`,
`download_logs`, `contact_messages`. Détail en Phase 2+.

## Phases de développement

Voir `docs/development.md`. Phases 1 à 8 livrées :
Phase 2 — Authentification : Argon2id, sessions httpOnly hashées, CSRF double-submit signé,
rate limiting + lockout, bootstrap admin CLI (`npm run setup:admin`), zones frontend
`/login`, `/app`, `/admin` avec gardes `RequireAuth`/`RequireAdmin`.
Phase 3 — Utilisateurs : CRUD admin, rôles, statuts, reset mot de passe, journaux de connexion.
Phase 4 — Contenu : articles, catégories hiérarchiques, tags, machine à états (DRAFT/PUBLISHED/ARCHIVED),
slugs, recherche, audit atomique.
Phase 5 — Médias : images uploadées (miniatures, alt-text, galerie d'articles), vidéos externes
(YouTube/Vimeo HTTPS-only), statuts.
Phase 6 — Téléchargements : PDF, applications mobiles/desktops, catégories, validation magic bytes,
SHA-256, stockage UUID, streaming authentifié, journaux de téléchargement, audit.
Phase 7 — Contact : formulaire de contact USER, modération ADMIN (NEW/READ/REPLIED/ARCHIVED),
rate limiting, audit, journaux.
Phase 8 — Durcissement sécurité : CSP personnalisée (frame-src YouTube/Vimeo, frame-ancestors self),
rate limiting global, CORS configurable, suppression storage_path des réponses API,
HTTPS-only pour vidéos, audit étendu (articles, médias, contact), 60 tests de sécurité ajoutés.
