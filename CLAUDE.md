# CLAUDE.md — Site News (actualites)

## Stack
- **Monorepo:** `backend/` (Node + Express + Prisma, port 8080), `frontend/` (React 19 + TS + Vite + Tailwind CSS v4), `e2e/`, `scripts/`, `docs/`.
- Frontend: React Router 7, TanStack Query 5, Zustand, Axios, Vitest (jsdom), ESLint + Prettier.
- Commands (frontend): `npm run dev`, `npm run build` (tsc + vite), `npm run typecheck`, `npm run lint`, `npm test`.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Frontend conventions
- Theme via CSS variables `[data-theme]` on `<html>` (sombre par défaut, toggle localStorage). Tokens dans `src/index.css` (`@theme inline`).
- Fontes: Fraunces (titres), Instrument Sans (corps/UI), JetBrains Mono (données). Chargées dans `index.html`.
- Composants partagés dans `src/components/`. Classes utilitaires système (`.btn`, `.badge`, `.input`, `.card`, `.modal-*`, `.data-table`, `.pagination`, `.page-title`, `.article-body`) dans `index.css`.
- Corps d'articles HTML stylé par `.article-body` (pas de plugin typography).
- Accents en français avec accents (Actualités, Téléchargements, Créé le), conformément au design.
- Codes de test: `npm run typecheck && npm run lint && npm test` avant de finir un changement.