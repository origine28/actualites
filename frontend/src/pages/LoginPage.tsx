import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand.tsx';
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
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Brand to="/" />
          <p className="text-sm text-fg-muted">Édition généraliste — presse de référence</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg">Connexion</h1>
            <p className="mt-1 text-sm text-fg-muted">Accédez à votre espace de travail.</p>
          </div>

          {error && (
            <p role="alert" className="alert alert-error">
              {error}
            </p>
          )}

          <div className="field">
            <label htmlFor="username" className="field-label">
              Nom d'utilisateur
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="input"
            />
          </div>

          <div className="field">
            <label htmlFor="password" className="field-label">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="input"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>

          <p className="text-sm text-fg-muted">
            <Link to="/" className="link">
              Retour à l'accueil
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}