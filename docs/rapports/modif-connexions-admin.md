# Rapport de modification — Connexions utilisateurs (admin)

## 1. Objectif

Offrir, dans la page d'administration des utilisateurs, une interface permettant
d'afficher les **informations de connexion de chaque utilisateur** : horaire exact
de connexion, adresse IP publique et port source.

## 2. Changements

| Zone | Fichier | Changement |
|---|---|---|
| Backend | `backend/src/utils/ip.ts` | `resolveSourcePort` capture désormais le port du socket (`req.socket.remotePort`) **en accès direct comme derrière un proxy** (avant : renvoyait `NULL` dès qu'un proxy était détecté). Un port n'est jamais inventé. |
| Backend | `backend/tests/ip.test.ts`, `backend/tests/admin.login-history.test.ts` | Tests mis à jour pour refléter le nouveau comportement du port. |
| Frontend | `frontend/src/pages/admin/AdminUsersPage.tsx` | Bouton « Connexions » dans la colonne Actions de chaque utilisateur + nouvelle modale `LoginHistoryModal` (dernière connexion + historique paginé). |
| Frontend | `frontend/tests/helpers.ts` | Helper de test `makeLoginHistoryEntry`. |
| Frontend | `frontend/tests/admin/AdminUsersPage.test.tsx` | Nouveau (4 tests). |
| Admin | `frontend/src/services/admin.service.ts`, `frontend/src/types/admin.ts` | Aucun changement (services `getUserLoginHistory` et type `LoginHistoryEntry` existaient déjà ; ils sont désormais utilisés par l'UI). |

## 3. Interface ajoutée (admin)

Depuis le tableau **Administration → Utilisateurs**, chaque ligne possède un lien
**« Connexions »** qui ouvre une modale pour l'utilisateur concerné :

- **Dernière connexion** (résumé) : horaire, adresse IP publique, port source,
  résultat, type d'accès (USER/ADMIN), navigateur (user-agent).
- **Historique cliquable** : tableau paginé (Suivant/Précédent) des
  `login_logs` avec horaire exact (`created_at`), IP, port source, résultat
  (Connexion / Echec / Deconnexion), type d'accès et user-agent.

Données sources : route existante `GET /api/admin/users/:id/login-history`
(lecture, rôle ADMIN requis, jamais mise en cache).

## 4. Port source — comportement et interprétation

- **En accès local direct** : `req.socket.remotePort` est le port TCP client réel,
  capturé tel quel.
- **Derrière Cloudflare Tunnel** : Cloudflare ne transmet **jamais** le port TCP
  source du client. Le port capté est celui de la connexion locale entre
  `cloudflared` et l'application (socket interne éphémère). Il **n'est pas** le
  port du client et n'a **aucune valeur d'identification**.
- Un port n'est **jamais inventé** : s'il n'existe aucun port réel, `NULL` est
  conservé et l'UI affiche « Non disponible » / « N/A ».

### Point d'honnêteté (important)

Le port source TCP d'un client web est par nature **éphémère** : un numéro
aléatoire (plage ~49000-65500), **différent à chaque connexion/socket**, même pour
un même client en accès direct. Il ne permet donc **pas** d'identifier ni de suivre
un utilisateur de façon stable. La seule donnée réseau fiable pour l'usage
« informations de connexion par utilisateur » reste l'**adresse IP**
(`CF-Connecting-IP`), déjà capturée, complétée par le user-agent, l'horaire et la
session.

## 5. Solutions envisageables pour un « vrai » port client (non retenues)

| Solution | Faisabilité | Limite |
|---|---|---|
| `cf.edge.client_port` via Transform Rule Cloudflare | Plan Free | Champ peu documenté ; fournit le port de l'edge Cloudflare (souvent 443), pas le port du client. |
| PROXY Protocol (Spectrum) | Enterprise, proxying TCP/UDP non-HTTP | Non applicable à un site HTTP derrière un tunnel standard. |
| mmproxy / spoofing IP | Linux, code avancé | Incompatible W10 natif ; exige un proxy dédié ; le port reste peu fiable. |
| Envoyer le port depuis un script client | Non fiable | Un navigateur web n'expose pas le port TCP réel en HTTP/2+. |

Conclusion : pour un site web derrière Cloudflare Tunnel, **il n'existe pas de
moyen fiable et documenté d'obtenir le vrai port TCP source** du client. Le
comportement actuel (port de la socket vue par l'app, `NULL` sinon) est conservé.

## 6. Documentation mise à jour

- `docs/security.md` — section « Résolution d'IP et de port source ».
- `docs/cloudflared.md` — principe port source.
- `docs/architecture.md` — IP / port source.

## 7. Validation

| Vérification | Résultat |
|---|---|
| Backend typecheck | OK |
| Backend lint | OK |
| Backend tests (suite complète) | 302/302 |
| Frontend typecheck | OK |
| Frontend lint | OK |
| Frontend tests (suite complète) | 63/63 |
| Build (backend + frontend) | OK |

Note environnement : une catégorie « Economie » résiduelle du seed de démo
présente en base de dev cassait `content.categories.test.ts` (409 au lieu de 201,
collision de nom). Elle a été supprimée (aucun article lié) ; le test repasse.
