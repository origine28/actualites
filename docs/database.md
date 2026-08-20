# Base de données

## Serveur

- PostgreSQL **17.10** installé nativement sur Windows 10 (service `postgresql-x64-17`).
  Environnement actuel : **PostgreSQL 17.10 sous Windows 10. Compatible avec l'architecture PostgreSQL retenue.**
- **Utilisateur dédié** : `news_app` (permissions minimales).
- **Base dédiée** : `news_db`, propriétaire `news_app`.
- Connexion : `DATABASE_URL` dans `backend/.env` (jamais commitée).
- En développement, `news_app` dispose de `CREATEDB` pour permettre la **shadow database** de `prisma migrate dev`.

## Connexion de test (Phase 1)

```powershell
cd backend
npx prisma migrate deploy
npm run db:check   # retourne le nombre de lignes de la table technique systemInfo
```

## Modèles

### Phase 1

Modèle technique minimal `SystemInfo` (vérification du cycle migration/connexion).

### Phase 2 — Authentification

Schéma : `backend/prisma/schema.prisma`.

| Table | Rôle |
|---|---|
| `users` | Comptes : `username`, `email`, `password_hash` (Argon2id), `role` (`ADMIN`/`USER`), `status` (`ACTIVE`/`DISABLED`), `failed_login_attempts`, `locked_until`, `last_login_at`, soft delete `deleted_at` |
| `sessions` | Sessions actives : `token_hash` (SHA-256 du jeton, unique), `ip`, `user_agent`, `expires_at`, `revoked_at` |
| `login_logs` | Journal de connexion : `username`, `ip`, `source_port`, `result` (`SUCCESS`/`FAILURE`/`LOGOUT`), `access_type` (`USER`/`ADMIN`), `session_id` |
| `audit_logs` | Journal d'audit : `action`, `entity_type`, `entity_id`, `metadata` (JSON), `ip`, `user_agent` |

Contraintes de sécurité en base : mot de passe **uniquement** sous forme de hash Argon2id, jeton de session uniquement hashé, index sur `users(status)`, `sessions(expires_at, revoked_at)`, `login_logs(created_at)`, `audit_logs(action, created_at)`.

### Phase 3 — Utilisateurs

| Table | Rôle |
|---|---|
| `users` | Extension : champs `first_name`, `last_name` ajoutés lors de la gestion administrateur |
| `login_logs` | Extension : champs `cf_ip` pour la journalisation des connexions |

### Phase 4 — Contenu éditorial

| Table | Rôle |
|---|---|
| `categories` | Catégories hiérarchiques : `name`, `slug` (unique), `parent_id` (auto-référent), `sort_order`, `status` (`ACTIVE`/`INACTIVE`) |
| `tags` | Tags d'articles : `name`, `slug` (unique) |
| `article_tags` | Jonction Many-to-Many : `article_id` → `articles`, `tag_id` → `tags` |
| `articles` | Articles : `title`, `slug` (unique), `summary`, `content`, `category_id` FK → `categories`, `author_id` FK → `users`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `language`, `published_at`, soft delete |

### Phase 5 — Médias

| Table | Rôle |
|---|---|
| `images` | Images uploadées : `filename`, `original_name`, `path`, `mime_type`, `width`, `height`, `size_bytes`, `sha256`, `alt_text`, `variants` (JSON), `author_id` FK → `users` |
| `article_images` | Jonction Many-to-Many : `article_id` → `articles`, `image_id` → `images`, `position` pour l'ordre de la galerie, `is_featured` |
| `videos` | Vidéos externes (YouTube/Vimeo) : `title`, `platform` (`YOUTUBE`/`VIMEO`), `external_id`, `url`, `category_id` FK → `categories`, `author_id` FK → `users`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `published_at` |

### Phase 6 — Téléchargements

| Table | Rôle |
|---|---|
| `download_categories` | Catégories de téléchargements : `name`, `slug` (unique), `sort_order`, `status` (`ACTIVE`/`INACTIVE`) |
| `downloads` | Fichiers : `title`, `slug` (unique), `description`, `type` (`PDF`/`MOBILE`/`DESKTOP`), `platform` (`ANDROID`/`IOS`/`WINDOWS`/`LINUX`/`MACOS`/`OTHER`), `version`, `filename` (UUID serveur), `original_name`, `storage_path`, `mime_type`, `size_bytes`, `sha256`, `download_category_id` FK → `download_categories`, `author_id` FK → `users`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), `published_at`, soft delete |
| `download_logs` | Journal de téléchargement : `user_id` FK → `users` (Cascade), `download_id` FK → `downloads` (Cascade), `ip` |

### Phase 7 — Contact

| Table | Rôle |
|---|---|
| `contact_messages` | Messages de contact : `name`, `email`, `subject` (STRING 200), `message` (TEXT), `ip`, `status` (ENUM `NEW`/`READ`/`REPLIED`/`ARCHIVED`), `user_id` FK → `users` (SetNull). Suppression physique (hard delete) par l'admin. |

### Phases suivantes

Les modèles suivants seront ajoutés lors des phases futures.

## Sauvegarde et restauration

Voir `docs/backup.md`.
