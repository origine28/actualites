import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../helpers.ts';
import RequireAdmin from '../../src/components/RequireAdmin.tsx';
import RequireAuth from '../../src/components/RequireAuth.tsx';
import LoginPage from '../../src/pages/LoginPage.tsx';
import { useAuthStore } from '../../src/store/authStore.ts';

vi.mock('../../src/services/api.ts', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-token'),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

import { getMe } from '../../src/services/api.ts';

function renderRoutes(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <div>APP_ZONE</div>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <div>ADMIN_ZONE</div>
              </RequireAdmin>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Guards d authentification', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setLoading(true);
    vi.clearAllMocks();
  });

  it('RequireAuth redirige vers /login si non authentifié', async () => {
    vi.mocked(getMe).mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    renderRoutes('/app');

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument(),
    );
  });

  it('RequireAuth affiche le contenu protégé si authentifié', async () => {
    vi.mocked(getMe).mockResolvedValue(makeUser());
    renderRoutes('/app');

    await waitFor(() => expect(screen.getByText('APP_ZONE')).toBeInTheDocument());
  });

  it('RequireAdmin refuse l accès à un USER', async () => {
    vi.mocked(getMe).mockResolvedValue(makeUser({ role: 'USER' }));
    renderRoutes('/admin');

    await waitFor(() => expect(screen.getByText('Accès refusé')).toBeInTheDocument());
  });

  it('RequireAdmin affiche la zone pour un ADMIN', async () => {
    vi.mocked(getMe).mockResolvedValue(makeUser({ role: 'ADMIN' }));
    renderRoutes('/admin');

    await waitFor(() => expect(screen.getByText('ADMIN_ZONE')).toBeInTheDocument());
  });
});
