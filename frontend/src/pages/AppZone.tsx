import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand.tsx';
import ThemeToggle from '../components/ThemeToggle.tsx';
import { logout } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';

const NAV_LINKS = [
  { to: '/app/articles', label: 'Actualités' },
  { to: '/app/downloads', label: 'Téléchargements' },
  { to: '/app/contact', label: 'Contact' },
];

export default function AppZone() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // Même en cas d'erreur réseau, on repasse à l'état déconnecté côté client.
    } finally {
      useAuthStore.getState().clearAuth();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Brand to="/" />
          <div className="flex min-w-0 items-center gap-2">
            {user && (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="truncate text-sm font-medium text-fg-secondary">
                  {user.username}
                </span>
                <span
                  className={`badge ${user.role === 'ADMIN' ? 'badge-accent' : 'badge-neutral'}`}
                >
                  {user.role}
                </span>
              </div>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn btn-secondary btn-sm"
            >
              {loggingOut ? 'Déconnexion…' : 'Se déconnecter'}
            </button>
          </div>
        </div>
        <nav className="border-t border-edge">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 md:px-6">
            {NAV_LINKS.map((item) => (
              <Link key={item.to} to={item.to} className="btn btn-ghost btn-sm shrink-0">
                {item.label}
              </Link>
            ))}
            {user?.role === 'ADMIN' && (
              <Link to="/admin" className="btn btn-secondary btn-sm ml-auto shrink-0">
                Espace admin
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-edge py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 text-sm text-fg-muted md:px-6">
          <span>Site News — Espace connecté</span>
          <span>{user?.email ?? ''}</span>
        </div>
      </footer>
    </div>
  );
}