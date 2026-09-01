# Design System — Site News

## Product Context
- **What this is:** Plateauforme d'actualits française ("SITE NEWS") : une editorial media site with public article pages, an authenticated member area, and an admin back-office.
- **Who it's for:** Grand public (médias généralistes), lecteurs d'actualités, rédaction & admins internes.
- **Space/industry:** Presse en ligne, médias généralistes (Le Monde, France 24, The Guardian, BBC, NYT).
- **Project type:** Editorial news site (public) + member area + admin dashboard.

## Aesthetic Direction
- **Direction:** Editorial / Magazine — typographie serif dominante, hiérarchie de presse.
- **Decoration level:** minimal → intentional — surfaces "papier", filets fins (borders), léger grain/gradient sur les fonds.
- **Mood:** La crédibilité d'un journal à l'écran. Un média sérieux et lisible, pas une "dark app" générique.
- **Memorable thing:** Crédibilité éditoriale de presse — "ça ressemble à un vrai média".
- **Reference sites:** Le Monde, France 24, The Guardian, NYT, BBC, AP.

## Typography
- **Display/Hero:** Fraunces (serif variable, 9–144pt optical) — titres de une, page titles, headings admin. Caractère éditorial distinct.
- **Body:** Instrument Sans (grotesque douce) — corps d'articles, UI, formulaires, tableaux.
- **UI/Labels:** same as body (Instrument Sans).
- **Data/Tables:** JetBrains Mono (tabular-nums) pour les données admin, IPs, chiffres.
- **Code:** JetBrains Mono.
- **Loading:** Google Fonts via `<link>` dans index.html.
- **Scale:** display clamp(40-64px), page-title 30-32px, section 20-22px, card 15-19px, body 15-16px, meta 12-13px, micro 11-12px (uppercase, letterspacing).

## Color
- **Approach:** restrained — un seul accent pour les actions/liens, neutres chauds, sémantiques réservées au statut.
- **Primary (accent):** #E8A33D (sombre) / #B5651D (clair) — LE seul accent d'action. Le rouge-brut style presse laisse place à l'ocre ambre.
- **Accent strong (hover):** #F5B95A (sombre) / #E2893C (clair).
- **Accent contrast (texte sur accent):** #1A1304 (sombre) / #FFFFFF (clair).
- **Neutrals:** fond sombre #0E1116 → surfaces #151A22 / #1B222C → inset #0A0D12; fond clair #F6F3EE → surfaces #FFFFFF / #EFEAE1 → inset #F0ECE4. Neutres chauds, jamais gris froids purs.
- **Semantic:** success #3FB98A/#1F7A4D, error #E06262/#C0392B, warning #E8A33D/#B5651D, info #6EA8FE/#2D6DCC.
- **Dark mode:** par défaut. Refonte via variables CSS `[data-theme="dark"]` / `[data-theme="light"]`, toggle localStorage.

## Spacing
- **Base unit:** 4px.
- **Density:** confortable (lecture longue).
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** grid-disciplined — colonnes strictes, une en hero + grille, colonnes de lecture.
- **Grid:** une = 1.4fr / 1fr; grille articles 3 colonnes desktops, 1 mobile.
- **Max content width:** 1120px (wrap), prose 66ch.
- **Border radius:** sm:6px, md:10px, lg:16px, full:9999px.

## Motion
- **Approach:** intentional — transitions d'état (hover cards, focus inputs, alerts). Pas d'animation qui ralentit la lecture.
- **Easing:** ease-out pour entre, ease-in-out pour moves.
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms).

## Rules
- **Un seul accent d'action : l'ocre ambre.** L'émeraude n'est JAMAIS un CTA public — uniquement sémantique "succès/publié" dans l'admin.
- **Les titres de presse (hero, une, headings) sont en Fraunces.** Le corps reste Instrument Sans.
- **Le corps des articles (`dangerouslySetInnerHTML`) est stylé via la classe `.article-body`** — neutre, hiérarchie p/h2/h3/blockquote/img.
- Fontes sans système par défaut sur les éléments de marque. Blacklist: Inter, Roboto, Space Grotesk comme primary.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-01 | Initial design system created | Par /design-consultation — positionnement médias généralistes grand public, chose mémorable = crédibilité éditoriale de presse. Validation utilisateur sur maquette HTML (une, article, admin; toggle clair/sombre). |
| 2026-09-01 | Accent unique ocre ambre, émeraude retiré des CTA publics | L'incohérence ambre/émeraude était la racine du manque de cohérence visuelle. |
| 2026-09-01 | Toggle clair/sombre (sombre par défaut) | Posture attendue; préférée par l'utilisateur. |