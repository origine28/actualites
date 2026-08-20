# Demo V0.1 — Guide de demonstration

## A. Pre-requis

- **OS** : Windows 10
- **Node.js** : >= 24.0.0
- **npm** : inclus avec Node.js
- **PostgreSQL** : 17.10 (ou compatible)
- **Git** : pour cloner le depot (optionnel)
- **cloudflared** : pour exposer le tunnel (optionnel, voir section L)

## B. Installation

```powershell
cd projets/web\actualites
npm install
```

## C. Configuration

1. Copier le fichier d'exemple :

```powershell
Copy-Item backend\.env.example backend\.env
```

2. Ouvrir `backend\.env` et modifier les variables :

| Variable | Valeur recommandee |
|---|---|
| `DATABASE_URL` | `postgresql://news_app:VOTRE_MDP@127.0.0.1:5432/news_db?schema=public` |
| `SESSION_SECRET` | Generer avec : `openssl rand -base64 32` |
| `CSRF_SECRET` | Generer avec : `openssl rand -base64 32` |
| `NODE_ENV` | `development` |
| `PORT` | `8080` |
| `HOST` | `127.0.0.1` |

> **IMPORTANT** : Ne jamais commit le fichier `.env`.

## D. Base de donnees

1. Verifier que PostgreSQL est demarre :
```powershell
Get-Service postgresql*
```

2. Creer la base si elle n'existe pas :
```sql
CREATE DATABASE news_db;
CREATE USER news_app WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE news_db TO news_app;
```

3. Appliquer les migrations :
```powershell
npm run prisma:deploy --workspace @news/backend
```

4. Generer le client Prisma :
```powershell
npm run prisma:generate --workspace @news/backend
```

## E. Donnees de demonstration

Peupler la base avec les donnees de demo :

```powershell
npm run seed:demo --workspace @news/backend
```

Ceci cree :
- Compte USER : `demo_user` / `DemoUser1!`
- Compte ADMIN : `demo_admin` / `DemoAdmin1!`
- 3 categories : Technologie, Sciences, Economie
- 4 tags : React, Node.js, PostgreSQL, Securite
- 3 articles (2 publies, 1 brouillon)

> Le seed est **sans danger** : il met a jour les comptes existants sans dupliquer, et cree les contenus uniquement s'ils n'existent pas.

## F. Demarrage

### Option 1 : Backend + Frontend en parallele

```powershell
npm run dev
```

### Option 2 : Deux terminaux separes

```powershell
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend
```

## G. URLs de demonstration

| Service | URL |
|---|---|
| Frontend | http://127.0.0.1:5173 |
| Backend API | http://127.0.0.1:8080 |
| Health check | http://127.0.0.1:8080/api/health |

## H. Comptes de demonstration

| Role | Username | Mot de passe |
|---|---|---|
| USER | demo_user | DemoUser1! |
| ADMIN | demo_admin | DemoAdmin1! |

## I. Scenario de demonstration (10-15 min)

### Partie 1 — Espace utilisateur (5 min)

| # | Etape | Action | Resultat attendu |
|---|---|---|---|
| 1 | Login USER | Ouvrir http://127.0.0.1:5173, cliquer "Connexion", entrer `demo_user` / `DemoUser1!` | Redirection vers /app, profil affiche |
| 2 | Articles | Cliquer "Actualites" dans la navigation | Liste des 2 articles publies |
| 3 | Detail article | Cliquer sur un article | Titre, contenu HTML, categorie, tags, auteur |
| 4 | Telechargements | Cliquer "Telechargements" | Page accessible |
| 5 | Contact | Cliquer "Contact", remplir le formulaire, envoyer | Message de succes |
| 6 | Logout | Cliquer "Se deconnecter" | Redirection vers /login |

### Partie 2 — Espace administration (7 min)

| # | Etape | Action | Resultat attendu |
|---|---|---|---|
| 7 | Login ADMIN | Se connecter avec `demo_admin` / `DemoAdmin1!` | Espace admin accessible |
| 8 | Utilisateurs | Naviguer vers "Utilisateurs" | Liste des comptes, CRUD fonctionnel |
| 9 | Articles | Naviguer vers "Articles" | 3 articles, 2 publies + 1 brouillon |
| 10 | Creer article | Cliquer "Nouveau", remplir (titre, contenu, categorie, tags), publier | Article cree et visible |
| 11 | Categories | Naviguer vers "Categories" | 3 categories, CRUD fonctionnel |
| 12 | Tags | Naviguer vers "Tags" | 4 tags, CRUD fonctionnel |
| 13 | Images | Naviguer vers "Images", uploader une image | Image avec variants auto |
| 14 | Videos | Naviguer vers "Videos", ajouter une video YouTube | Video avec player integre |
| 15 | Messages contact | Naviguer vers "Contact" | Message envoye par demo_user visible, moderation possible |
| 16 | Logout | Se deconnecter | Fin de la demonstration |

### Actions les plus impressionnantes pour le client

- **Creer et publier un article** (etape 10) — montre le workflow complet
- **Upload d'image avec variants** (etape 13) — montre la gestion media
- **Moderation contact** (etape 15) — montre l'interaction USER/ADMIN
- **Protection securite** — USER ne peut pas acceder aux routes ADMIN

## J. Contenu pre-charge

| Type | Contenu |
|---|---|
| Categories | Technologie, Sciences, Economie |
| Tags | React, Node.js, PostgreSQL, Securite |
| Articles | "Bienvenue sur la plateforme NEWS" (publie) |
| | "Nouvelles fonctionnalites securite" (publie) |
| | "Brouillon : article en cours de redaction" (brouillon) |

## K. Limitations V0.1

- Pas de stockage R2 (fichiers sur disque local)
- Pas de CDN de production
- Pas de CAPTCHA
- Pas de paiement
- Fichiers limites a 100 Mo (MAX_APP_SIZE)
- Pas de rich text editor (contenu HTML en brut)
- Pas de systeme de commentaires
- Pas de newsletter
- Pas de monitoring production
- Tunnel Cloudflare Quick Tunnel (temporaire, sans SLA)

## L. Cloudflare Tunnel — Exposer la demo a Internet

### Pre-requis

Installer cloudflared :
```powershell
winget install Cloudflare.cloudflared
```

Verifier l'installation :
```powershell
cloudflared --version
```

### Lancement (Quick Tunnel)

Ouvrir un **nouveau terminal** et lancer :

```powershell
cloudflared tunnel --url http://127.0.0.1:5173
```

Cloudflared affichera une URL temporaire du type :
```
https://xxxx-xxxx-xxxx.trycloudflare.com
```

> **IMPORTANT** : Le frontend Vite doit etre lance avec `allowedHosts: true` dans `vite.config.ts` pour accepter les requetes via le tunnel.

### Verification

Verifier que le tunnel fonctionne :
```powershell
# Frontend
curl https://VOTRE-URL.trycloudflare.com

# API
curl https://VOTRE-URL.trycloudflare.com/api/health
```

### Authentification via tunnel

Les cookies de session, le CSRF et l'authentification fonctionnent normalement via le tunnel :
- Login USER et ADMIN fonctionnent
- Les routes admin sont protegees
- Les cookies `HttpOnly` et `SameSite=Lax` sont actifs
- Le cache est desactive sur le contenu authentifie (`Cache-Control: private, no-store`)

### Arret

```powershell
Ctrl+C dans le terminal cloudflared
```

### Relance

```powershell
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Frontend
npm run dev:frontend

# Terminal 3 — Tunnel
cloudflared tunnel --url http://127.0.0.1:5173
```

### Limitations du Quick Tunnel

- **Temporaire** : l'URL change a chaque relance
- **Pas de SLA** : pas de garantie de disponibilite
- **Pas de nom de domaine** : URL aleatoire *.trycloudflare.com
- **Usage demo uniquement** : pour la production, utiliser un tunnel nomme

### Pour une URL fixe (optionnel)

Si vous avez un compte Cloudflare, vous pouvez creer un tunnel nomme avec un hostname fixe :

```powershell
# 1. Connexion a Cloudflare
cloudflared tunnel login

# 2. Creer le tunnel
cloudflared tunnel create actualites

# 3. Configurer l'ingress (creer config.yml)
# 4. Creer le DNS
cloudflared tunnel route dns actualites actualites.votredomaine.com

# 5. Lancer
cloudflared tunnel run actualites
```

## M. Securite verifiee

| Protection | Statut |
|---|---|
| Authentification Argon2id | OK |
| Autorisation (USER != ADMIN) | OK |
| CSRF double-submit | OK |
| Sessions serveur httpOnly | OK |
| Rate limiting (login, contact, global) | OK |
| Headers securite (Helmet) | OK |
| CSP personnalisee | OK |
| Cache no-store sur contenu authentifie | OK |
| Validation upload (magic bytes, extension) | OK |
| Protection path traversal | OK |
| Protection IDOR | OK |
| Audit logs | OK |
| Backend non expose depuis Internet | OK |
| PostgreSQL non expose depuis Internet | OK |

## N. Documentation complementaire

- Architecture : [docs/architecture.md](architecture.md)
- Securite : [docs/securite.md](securite.md)
- Cloudflared : [docs/cloudflared.md](cloudflared.md)
- Rapport de validation : [docs/rapports/v0.1-demo.md](rapports/v0.1-demo.md)
