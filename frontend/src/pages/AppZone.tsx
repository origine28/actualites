import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 text-slate-100">
      <Outlet />

      <h1 className="text-3xl font-bold">Espace connecté</h1>

      {user && (
        <div className="rounded bg-slate-800 px-6 py-4 text-center">
          <p className="text-lg font-semibold">{user.username}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
          <p className="mt-2">
            <span
              className={`rounded px-2 py-1 text-xs font-semibold ${
                user.role === 'ADMIN'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {user.role}
            </span>
          </p>
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
              Espace admin
            </Link>
          )}
        </div>
      )}

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600 disabled:opacity-50"
      >
        {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
      </button>

      <Link to="/" className="text-sm text-slate-400 hover:underline">
        Accueil
      </Link>

      <div className="flex gap-4">
        <Link to="/app/articles" className="text-sm text-amber-400 hover:underline">
          Actualites
        </Link>
        <Link to="/app/downloads" className="text-sm text-amber-400 hover:underline">
          Telechargements
        </Link>
        <Link to="/app/contact" className="text-sm text-amber-400 hover:underline">
          Contact
        </Link>
      </div>
    </main>
  );
}
