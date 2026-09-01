import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle.tsx';
import { logout } from '../../services/api.ts';
import { useAuthStore } from '../../store/authStore.ts';

const navItems = [
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/articles', label: 'Articles' },
  { to: '/admin/categories', label: 'Catégories' },
  { to: '/admin/tags', label: 'Tags' },
  { to: '/admin/images', label: 'Images' },
  { to: '/admin/videos', label: 'Vidéos' },
  { to: '/admin/downloads', label: 'Téléchargements' },
  { to: '/admin/contact', label: 'Contact' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="border-b border-edge bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <Link
            to="/admin/images"
            className="font-display text-lg font-bold tracking-tight text-accent transition-colors hover:text-accent-strong"
          >
            Administration
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'rounded-sm bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong'
                    : 'rounded-sm px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-control hover:text-fg'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-fg-muted sm:inline">{user?.username}</span>
            <ThemeToggle />
            <Link to="/" className="btn btn-ghost btn-sm">
              Site public
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}