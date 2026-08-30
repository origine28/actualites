# Cloudflared / Cloudflare

Architecture (définitive) :

```
Internet
   ↓
Cloudflare (HTTPS, cache, CF-Connecting-IP)
   ↓
Cloudflare Tunnel
   ↓
cloudflared (Windows 10)
   ↓
127.0.0.1:8080
   ↓
Express
   ↓
PostgreSQL + storage/
```

## Principes

- **Aucun port entrant ouvert** sur le routeur ; le backend n'est jamais exposé directement à Internet.
- **Tunnel nommé** (Cloudflare Zero Trust), service Windows (`cloudflared service install`).
- **HTTPS fourni par Cloudflare** (certificat géré automatiquement).
- **Firewall Windows** : backend en écoute `127.0.0.1` uniquement + règle bloquant l'accès externe.
- **IP réelle** : `CF-Connecting-IP` (posé/écrasé par Cloudflare ; seul cloudflared atteint l'app via loopback → pas de falsification possible).
- **Port source** : le port TCP client réel est **invisible** à travers le tunnel (Cloudflare ne le transmet pas). L'application capture le port de la socket qu'elle voit (`req.socket.remotePort`), c.-à-d. l'extrémité locale du tunnel — une valeur éphémère **sans signification** pour identifier un client. Jamais de port inventé : absent réellement → `NULL`.
- **Règles de cache sécurisées** : contenu authentifié jamais mis en cache partagé (voir ci-dessous).

## Cache

| Ressource | Cache Cloudflare |
|---|---|
| `/api/*` authentifié | **Jamais** (`Cache-Control: private, no-store`) |
| `/login`, `/admin/*` | **Jamais** |
| Téléchargements authentifiés | **Jamais** |
| Assets statiques **hashés** | Oui (`public, max-age=31536000, immutable`) |

Cache Rules à configurer dans le dashboard Cloudflare :
1. « Do Not Cache » pour `/api/*`, `/login`, `/admin/*` (et tout chemin selon cookie de session).
2. Ne jamais activer « Cache Everything » sur ces chemins.

## Limite d'upload

La taille maximale d'un body HTTP à l'edge Cloudflare dépend du plan
(Free/Pro : 100 MB ; Business : 200 MB ; Enterprise : 500 MB par défaut, évolutif).
La V1 utilise une **limite applicative de 100 Mo** (`MAX_APP_SIZE`), configurable,
pour rester prévisible sur Free/Pro. Au-delà : évolution vers upload direct / R2 (hors V1).

## Configuration

Documentée à la Phase 11 (`docs/cloudflared.md` sera complété à ce moment-là).
