import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand.tsx';
import ThemeToggle from '../components/ThemeToggle.tsx';
import { getHealth } from '../services/api.ts';

export default function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Brand to="/" />
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost btn-sm">
              Connexion
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <p className="kicker mb-4">L&apos;actualité en continu</p>
        <h1 className="font-display text-5xl font-black tracking-tight text-fg md:text-7xl">
          SITE NEWS
        </h1>
        <p className="mt-4 max-w-xl text-lg text-fg-secondary">
          Plateforme d&apos;actualités — information vérifiée, mise en perspective.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/login" className="btn btn-primary">
            Se connecter
          </Link>
        </div>

        <div className="mt-14 min-h-8">
          {isPending && (
            <p className="text-sm text-fg-muted">Vérification du backend…</p>
          )}
          {isError && (
            <p role="alert" className="alert alert-error">
              Backend injoignable — /api/health
            </p>
          )}
          {data && (
            <p className="badge badge-success">Backend : {data.status}</p>
          )}
        </div>
      </main>

      <footer className="border-t border-edge py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-sm text-fg-muted md:px-6">
          <span>Site News © 2026</span>
          <Link to="/login" className="link">
            Espace de travail
          </Link>
        </div>
      </footer>
    </div>
  );
}