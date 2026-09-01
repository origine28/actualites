import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useAuthStore } from '../store/authStore.ts';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const role = useAuthStore((s) => s.user?.role);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas text-fg-muted">
        Chargement...
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-canvas px-4">
        <div className="card max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-danger">Accès refusé</h1>
          <p className="mt-2 text-fg-secondary">
            Cette section est réservée aux administrateurs.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}