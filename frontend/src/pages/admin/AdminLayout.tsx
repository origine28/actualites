import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../services/api.ts';
import { useAuthStore } from '../../store/authStore.ts';

const navItems = [
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/articles', label: 'Articles' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/tags', label: 'Tags' },
  { to: '/admin/images', label: 'Images' },
  { to: '/admin/videos', label: 'Videos' },
  { to: '/admin/downloads', label: 'Telechargements' },
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 bg-slate-800/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/admin/images" className="text-lg font-bold text-amber-400">
            Administration
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'rounded-md bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-300'
                    : 'rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{user?.username}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
