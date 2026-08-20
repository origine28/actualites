import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useAuthStore } from '../store/authStore.ts';

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const role = useAuthStore((s) => s.user?.role);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
        Chargement...
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-900 text-slate-100">
        <h1 className="text-2xl font-bold text-red-400">Accès refusé</h1>
        <p className="text-slate-400">Cette section est réservée aux administrateurs.</p>
      </main>
    );
  }

  return <>{children}</>;
}
