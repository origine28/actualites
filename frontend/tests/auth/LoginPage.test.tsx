import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../helpers.ts';
import LoginPage from '../../src/pages/LoginPage.tsx';
import { useAuthStore } from '../../src/store/authStore.ts';

vi.mock('../../src/services/api.ts', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-token'),
  login: vi.fn(),
}));

import { getCsrfToken, login } from '../../src/services/api.ts';

function renderLogin(initialEntry = '/login') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>APP_PLACEHOLDER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(username = 'alice', password = 'secret') {
  await userEvent.type(screen.getByLabelText(/Nom d'utilisateur/), username);
  await userEvent.type(screen.getByLabelText(/Mot de passe/), password);
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.clearAllMocks();
  });

  it('affiche le formulaire et demande un jeton CSRF au chargement', () => {
    renderLogin();
    expect(screen.getByLabelText(/Nom d'utilisateur/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
    expect(getCsrfToken).toHaveBeenCalled();
  });

  it('connecte, met à jour le store et redirige vers /app', async () => {
    vi.mocked(login).mockResolvedValue(makeUser({ username: 'alice', role: 'ADMIN' }));
    renderLogin();

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText('APP_PLACEHOLDER')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith('alice', 'secret');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('affiche le message d erreur du backend en cas d echec', async () => {
    vi.mocked(login).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants invalides.' } },
      },
    });
    renderLogin();

    await fillAndSubmit('bob', 'wrong');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Identifiants invalides.'),
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("redirige vers /app si déjà connecté", () => {
    useAuthStore.getState().setUser(makeUser());
    renderLogin();
    expect(screen.getByText('APP_PLACEHOLDER')).toBeInTheDocument();
  });
});
