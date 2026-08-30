# Sécurité

Résumé de la matrice de sécurité validée (détail complet dans la conception Phase 0).

## Principes non négociables

- Aucun fichier uploadé ne doit pouvoir être **exécuté** par le serveur.
- `storage/` est **hors webroot** ; aucun accès statique aux fichiers privés.
- Téléchargement **uniquement via API authentifiée** avec `Content-Disposition: attachment` et `X-Content-Type-Options: nosniff`.
- Noms de fichiers **générés côté serveur** (UUID), chemins strictement contrôlés, SHA-256 enregistré.
- Validation des **extensions + signatures réelles** quand elles existent ; aucune fausse garantie de format (ex. DMG : vérification du trailer `koly` en fin de fichier, sinon niveau documenté).
- **Contenu authentifié = jamais de cache partagé** : `/api/*`, `/login`, `/admin/*`, téléchargements → `Cache-Control: private, no-store`.
- IP : `CF-Connecting-IP` uniquement ; les headers du navigateur ne sont jamais fiables ; le port source capté est **celui de l'extrémité vue par l'application** (voir « Résolution d'IP »), jamais un port inventé.
- Backend bindé sur `127.0.0.1` uniquement ; aucune écoute sur `0.0.0.0`.
- Secrets uniquement dans `.env` (gitignoré) ; `.env.example` sans valeur réelle.
- TypeScript strict ; validation d'environnement Zod ; limites de tailles configurables.

## En-têtes HTTP / Helmet (Phase 1 + Phase 8)

Helmet est actif sur le backend avec CSP personnalisée :

- `default-src 'self'`
- `script-src 'self'` (pas de inline scripts)
- `style-src 'self' 'unsafe-inline'` (Tailwind CSS nécessite `unsafe-inline`)
- `img-src 'self' data: blob:` (images locales + base64)
- `media-src 'self'`
- `font-src 'self'`
- `connect-src 'self'` (API same-origin)
- `frame-src https://www.youtube.com https://player.vimeo.com` (vidéos externes autorisées)
- `frame-ancestors 'self'` (anti-clickjacking)
- `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy` (Helmet default)
- `X-Powered-By` supprimé

**HSTS** : activé uniquement en production (Helmet default) — pas en dev HTTP localhost.

## CORS (Phase 8)

Configuré via `CORS_ORIGIN` dans `.env` :
- Vide/absent = same-origin (pas de headers CORS ajoutés, comportement par défaut).
- Exemple : `CORS_ORIGIN=https://news.example.com` pour cross-origin.

## Authentification (Phase 2)

- **Hachage** : Argon2id (OWASP, coûts configurables : `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`).
- **Sessions** : jeton opaque aléatoire (32 octets) stocké **hashé** (SHA-256) en base, jamais en clair ; cookie `news.sid` **httpOnly**, `SameSite=Lax`, `Secure` en production (`COOKIE_SECURE=true`), TTL `SESSION_TTL_HOURS`.
- **CSRF** : double-submit avec jeton **signé HMAC** (cookie `news.csrf` + en-tête `X-CSRF-Token`) sur toutes les mutations ; vérification à temps constant.
- **Anti brute-force** : verrouillage temporaire du compte après `LOGIN_MAX_ATTEMPTS` échecs (`locked_until`), rate limiting IP sur `POST /api/auth/login` (`LOGIN_RATE_LIMIT_WINDOW_MS` / `LOGIN_RATE_LIMIT_MAX`).
- **Anti-énumération / anti-timing** : messages d'erreur volontairement génériques ; comparaison Argon2 toujours effectuée même si l'utilisateur n'existe pas (utilisateur factice).
- **Autorisation** : middleware `requireAuth` (session valide) + `requireRole` (`ADMIN`/`USER`) au niveau des routes. Chaque route admin vérifie côté backend — le frontend n'est jamais une barrière de sécurité.
- **Réponses d'authentification** : `Cache-Control: private, no-store` ; aucune donnée de session en localStorage.
- **Désactivation de compte** : login refusé (`ACCOUNT_DISABLED`) et toutes les sessions actives révoquées.
- **Journalisation** : `login_logs` (succès/échec/déconnexion) et `audit_logs` (connexion, déconnexion, verrouillage…) horodatés avec IP/User-Agent.
- **Secrets** : `SESSION_SECRET`/`CSRF_SECRET` (≥ 32 caractères) uniquement dans `backend/.env` gitignoré.

## Rate limiting (Phase 2 + Phase 8)

- **Login** : 20 requêtes / 15 min par IP (`LOGIN_RATE_LIMIT_WINDOW_MS` / `LOGIN_RATE_LIMIT_MAX`).
- **Contact** : 5 messages / 15 min par IP.
- **Global** : 200 requêtes / 15 min par IP sur `/api/*` (anti-DDoS basique).

## Résolution d'IP et de port source (Phase 3 + Phase 8)

Chaîne de confiance : `CF-Connecting-IP` → `req.ip` (loopback trust proxy) → `req.socket.remoteAddress` → `'unknown'`.
- `X-Forwarded-For` de l'extérieur est ignoré (trust proxy = `loopback` uniquement).
- Validation `net.isIP()` + longueur max 45.

**Port source** (`resolveSourcePort`) : capture `req.socket.remotePort` lorsqu'il existe, **en accès direct comme derrière un proxy**. Un port n'est jamais inventé ; s'il n'y a aucun port réel, `NULL` est conservé.

⚠️ **Interprétation derrière Cloudflare Tunnel** : Cloudflare ne transmet **jamais** le port TCP source réel du client. Le port capté derrière un tunnel est donc le port interne de la connexion locale (cloudflared → origin), une socket éphémère sans signification — ce **n'est pas** le port du client. Le port source TCP d'un client web est de toute façon éphémère (port aléatoire, différent à chaque connexion) : il n'est **pas un identifiant stable** d'un utilisateur. L'IP reste l'identifiant réseau fiable à privilégier.

## XSS / Rendu Markdown (Phase 8)

- **Aucun** `dangerouslySetInnerHTML` dans le frontend.
- **Aucune** bibliothèque Markdown dans le frontend (le contenu est stocké tel quel, rendu par le client sans conversion HTML).
- React escape automatiquement toutes les variables JSX `{variable}`.
- Les URLs vidéo sont normalisées côté serveur (`parseVideoUrl`) : seuls les hôtes YouTube/Vimeo sont acceptés, l'URL stockée est toujours l'URL d'embed (`https://www.youtube.com/embed/ID`).
- Les vidéos n'acceptent que HTTPS (`http:` rejeté).

## Uploads (Phase 5 + Phase 6)

- **Taille maximale** : 5 Mo (images), 50 Mo (PDF), 100 Mo (applications) — configurable.
- **Magic bytes** : validation de la signature binaire réelle (JPEG, PNG, WEBP, AVIF, PDF, ZIP/EXE/PE, DMG koly, ELF).
- **Extension allowlist** : par type (PDF, MOBILE, DESKTOP).
- **Double extension** bloquée (`file.pdf.exe`).
- **MIME vérifié** : type MIME déclaré comparé au type attendu pour l'extension.
- **Nom serveur UUID** : le nom client n'est jamais utilisé pour le chemin final.
- **sharp re-encoding** : les images sont ré-encodées (neutralise EXIF, payloads malveillants, polyglots).
- **Mémoire uniquement** : multer en `memoryStorage()`, pas de fichier temporaire sur disque avant validation.
- **Path traversal** : `LocalStorageService.resolve()` valide chaque segment contre une regex `SAFE_SEGMENT`.
- **Rollback disque** : si la transaction DB échoue, les fichiers écrits sont supprimés.

## Téléchargements (Phase 6 + Phase 8)

- `GET /api/downloads/:id/file` : authentifié, `PUBLISHED` uniquement (DRAFT/ARCHIVED → 404).
- `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` + `Cache-Control: private, no-store`.
- `storage_path` **exclu** des réponses API (pas de fuite de chemin disque).
- SHA-256 enregistré et visible dans l'interface admin.
- Journalisation des téléchargements (`download_logs`).

## Path traversal (Phase 8)

`LocalStorageService.resolve()` :
- Valide chaque segment avec regex `^[a-zA-Z0-9][a-zA-Z0-9._-]*$`.
- Rejette `.` et `..`.
- Vérifie que le chemin résolu reste sous la racine (`startsWith(root + sep)`).
- Rejette les chemins absolus et les drive letters Windows.

## IDOR (Phase 8)

- Tous les endpoints admin vérifient `requireAuth` + `requireRole('ADMIN')` côté backend.
- Les UUID sont validés par Zod (`idParamSchema`) — les IDs malformés retournent 404.
- Un USER ne peut jamais accéder aux routes admin (testé dans `security.test.ts`).
- Les IDs inexistants retournent systématiquement 404.

## Cache / Cloudflare (Phase 8)

- **Contenu authentifié** = `Cache-Control: private, no-store` (jamais de cache partagé).
- **Assets statiques hashés** = `public, max-age=31536000, immutable`.
- **Images** = `public, max-age=31536000, immutable` (contenu immutable, pas de données utilisateur).
- **Vidéos** = pas de cache (données Meta uniquement).
- Testé dans `cache.test.ts` et `security.test.ts`.

## Gestion des erreurs (Phase 8)

Le error handler global retourne **jamais** :
- Stack traces
- Chemins locaux Windows
- Variables d'environnement
- Secrets
- Détails SQL ou Prisma
- Détails Zod internes

Format standard : `{ error: { code: "...", message: "..." } }`.

## Audit (Phase 2 + Phase 7 + Phase 8)

Événements audités :
- `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `SESSION_REVOKED`
- `USER_CREATED`, `USER_UPDATED`, `USER_DISABLED`, `USER_ENABLED`, `USER_PASSWORD_RESET`
- `ARTICLE_CREATED`, `ARTICLE_UPDATED`, `ARTICLE_PUBLISHED`, `ARTICLE_ARCHIVED`, `ARTICLE_DELETED`
- `VIDEO_CREATED`, `VIDEO_UPDATED`, `VIDEO_PUBLISHED`, `VIDEO_ARCHIVED`, `VIDEO_DELETED`, `VIDEO_RESTORED`
- `DOWNLOAD_CREATED`, `DOWNLOAD_UPDATED`, `DOWNLOAD_PUBLISHED`, `DOWNLOAD_ARCHIVED`, `DOWNLOAD_DELETED`, `DOWNLOAD_FILE_REPLACED`
- `DOWNLOAD_CATEGORY_CREATED`, `DOWNLOAD_CATEGORY_UPDATED`, `DOWNLOAD_CATEGORY_DELETED`
- `CONTACT_MESSAGE_CREATED`, `CONTACT_MESSAGE_READ`, `CONTACT_MESSAGE_REPLIED`, `CONTACT_MESSAGE_ARCHIVED`, `CONTACT_MESSAGE_DELETED`
- `IMAGE_UPLOADED`, `IMAGE_UPDATED`, `IMAGE_DELETED`
- `ARTICLE_IMAGES_ADDED`, `ARTICLE_IMAGES_REMOVED`, `ARTICLE_IMAGES_REORDERED`, `ARTICLE_FEATURED_IMAGE_UPDATED`

Chaque entrée inclut : `user_id`, `action`, `entity_type`, `entity_id`, `metadata` (sans secrets), `ip`, `user_agent`.

## Données sensibles (Phase 8)

Aucune réponse API ne contient :
- `password_hash`
- Token de session en clair
- Secret CSRF
- Variables d'environnement
- Paths disque (`storage_path` exclu des downloads)
- Stack traces

## Limitations connues

- **Pas de rotation de session** : le token reste stable pendant la durée de vie (TTL). Acceptable pour des sessions courtes (24h) avec sliding window.
- **Pas de limite de sessions concurrentes** : un utilisateur peut théoriquement créer plusieurs sessions. Acceptable en V1.
- **Password policy** : min 8 caractères + minuscule + majuscule + chiffre (pas de caractère spécial requis). Acceptable.
- **Pas de CAPTCHA/honeypot** sur le formulaire de contact. Le rate limiting (5 messages/15min) est la protection principale.
- **Images** : `Cache-Control: immutable` sur les images servies — les images ne contiennent pas de données utilisateur sensible, mais si un contenu est supprimé, les images orphelines restent accessibles via leur URL tant qu'elles existent en DB.
