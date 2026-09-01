# Rapport — Refonte UI « design system presse éditoriale »

## 1. Objectif

Remplacer les classes Tailwind ad hoc (slate/amber/emerald) encore présentes
dans l'interface par un **design system cohérent, validé** : une direction
esthétique unique « presse éditoriale », déclinée en tokens CSS, en classes
système et appliquée à l'ensemble des écrans publics et admin.

Ce rapport documente l'étape livrée : identité visuelle, tokens, composants
partagés, refonte des écrans, rétrocompatibilité des tests.

## 2. Design system

Direction acceptée (voir [DESIGN.md](../../DESIGN.md) pour la source de vérité) :

- **Mode sombre par défaut**, bascule clair/sombre persistée
  (`localStorage` → `site-news-theme`), rendu au chargement sans « flash »
  blanc (script inline dans `index.html`, attribut `data-theme` sur `<html>`).
- **Un seul accent d'action** : ocre ambre (`#e8a33d` sombre / `#b5651d` clair).
  L'émeraude est réservé aux états « succès / publié » (rôle strictement
  sémantique, plus jamais utilisé comme accent décoratif).
- **Neutres chauds « papier »** : fonds légèrement teintés, bordures discrètes.
- **Typographies** : Fraunces (titres de presse), Instrument Sans (corps/UI),
  JetBrains Mono (données : dates, IP, ports, slugs). Chargées via Google Fonts
  dans `frontend/index.html`.
- **Pas d'emojis dans l'UI** : les icônes d'extension de téléchargement sont
  des monogrammes (`P` / `M` / `D`) dans des tuiles `bg-accent-soft`.

### Tokens et classes système (`frontend/src/index.css`)

- Variables CSS `[data-theme='dark']` / `[data-theme='light']` : `--canvas`,
  `--surface`, `--surface-2`, `--surface-muted`, `--inset`, `--control`,
  `--edge`, `--fg`, `--fg-secondary`, `--fg-muted`, `--accent`,
  `--accent-strong`, `--accent-soft`, `--accent-contrast`, `--success`,
  `--danger`, `--warning`, `--info`.
- Tailwind CSS v4 : `@theme` (fontes + rayons 6/10/16px) puis `@theme inline`
  qui mappe `--color-*` vers les variables CSS du thème (les utilitaires
  `text-fg`, `bg-surface`, `border-edge`, `text-accent`… suivent le thème).
- Classes composants (`@layer components`) : `.btn` (`-primary`, `-secondary`,
  `-ghost`, `-danger`, `-sm`), `.badge` (+ variantes sémantiques), `.alert`,
  `.field`/`.field-label`, `.input`/`.input-mono`, `.card`/`.card-hover`,
  `.modal-overlay`/`.modal-panel`, `.table-wrap`/`.data-table`,
  `.page-btn` (`-active`, `-disabled`), `.kicker`/`.page-title`/
  `.page-subtitle`/`.page-title-lg`, `.link`.
- Corps d'article HTML : `.article-body` (lettrine sur le premier paragraphe,
  blockquotes Fraunces, images arrondies, code mono). Aucun plugin typography.

## 3. Changements

| Zone | Fichier | Changement |
|---|---|---|
| Socle | `frontend/index.html` | Langue `fr`, `data-theme="dark"` par défaut, Google Fonts, script anti-flash thème. |
| Socle | `frontend/src/index.css` | Tokens dark/light + classes système (section 2). |
| Composants | `frontend/src/components/Brand.tsx` *(nouveau)* | Logo « SN » (tuile accent) + mot-symbole « Site News ». |
| Composants | `frontend/src/components/ThemeToggle.tsx` *(nouveau)* | Bascule « Clair / Sombre » persistée. |
| Public | `HomePage`, `LoginPage`, `AppZone`, `ArticlesPage`, `ArticleDetailPage`, `DownloadsPage`, `ContactPage` | Refonte complète (shell sticky, hero, cartes, badges, pagination), classes système. |
| Gardes | `RequireAuth.tsx`, `RequireAdmin.tsx` | Re-stylé (état d'attente/refus en `.card`). |
| Admin | `AdminLayout.tsx` | Shell admin : mot-symbole « Administration », nav avec état actif `bg-accent-soft`, ThemeToggle, lien « Site public », déconnexion. |
| Admin | `AdminUsersPage`, `AdminContactPage`, `AdminDownloadsPage`, `AdminCategoriesPage`, `AdminTagsPage`, `AdminArticlesPage`, `AdminArticleEditorPage`, `MediaImagesPage`, `MediaVideosPage` | Refonte complète : `.data-table`, badges de statut, modales `.modal-*`, formulaires `.field`/`.input`, pagination `.page-btn`. |
| Backend | `download.controller.ts`, `download.routes.ts`, `download.service.ts`, `security.test.ts` | **Inclus dans l'étape mais non lié au design** (worktree déjà en cours) : liste publique des téléchargements et téléchargement de fichier accessibles **sans authentification** (`optionalAuth`) ; log de téléchargement écrit uniquement si un utilisateur est identifié. |
| Tests | `backend/tests/downloads.test.ts` | Assertion de filtre `type=MOBILE` rendue robuste à d'éventuels MOBILE publiés préexistants en base (voir note environnement). |

## 4. Rétrocompatibilité des tests

Les contrats textuels assertés par la suite vitest frontend ont été **conservés
à l'identique** lors de la refonte, y compris là où des libellés sans accents
sont exigés par les tests (« Telecharger », « Aucun telechargement disponible. »,
« Creer », « Message envoye avec succes. », « Connexion / Echec / Deconnexion »,
« Nouveau telechargement », « Guide PDF »…). Les libellés UI restants utilisent
les accents français conformément à la convention (ex. « Accès refusé »,
« Image importée avec succès. »).

## 5. Validation

| Vérification | Résultat |
|---|---|
| Backend typecheck | OK |
| Backend lint | OK |
| Backend tests (suite complète) | 302/302 |
| Frontend typecheck | OK |
| Frontend lint | OK |
| Frontend tests (suite complète) | 63/63 |

### Note environnement

Deux téléchargements MOBILE « publiés » résiduels de la base de dev partagée
(`PdfReaderPro`, créé le 2026-09-01, et `W-Shield (AdsBlocker)`) cassait le
test « filtre `type=MOBILE` » qui attendait une liste vide. Même classe de
pollution que la catégorie « Economie » documentée dans le rapport précédent.
Le test a été rendu robuste (il vérifie que le filtre ne renvoie que des
MOBILE publiés et n'expose jamais le brouillon créé par le test) au lieu de
supprimer les données de démonstration.