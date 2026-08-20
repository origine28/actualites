import { useEffect } from 'react';
import { getMe } from '../services/api.ts';
import { useAuthStore } from '../store/authStore.ts';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    if (!loading) return;

    let active = true;
    (async () => {
      try {
        const me = await getMe();
        if (active) setUser(me);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, setUser, setLoading]);

  return { user, isAuthenticated, loading };
}
