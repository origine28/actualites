import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCsrfToken, login } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';
import { getApiErrorMessage } from '../utils/error.ts';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCsrfToken().catch(() => {});
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(username, password);
      setUser(user);
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from ?? '/app', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Connexion impossible. Veuillez réessayer."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-slate-800 p-6 shadow-lg"
      >
        <h1 className="text-2xl font-bold">Connexion</h1>

        {error && (
          <p role="alert" className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="username" className="mb-1 block text-sm text-slate-300">
            Nom d'utilisateur
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-400"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-slate-300">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-400"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Connexion...' : 'Se connecter'}
        </button>

        <p className="text-sm text-slate-400">
          <Link to="/" className="hover:underline">
            Retour à l'accueil
          </Link>
        </p>
      </form>
    </main>
  );
}
