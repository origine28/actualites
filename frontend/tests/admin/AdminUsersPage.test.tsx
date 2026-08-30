import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoginHistoryEntry, makeUser } from '../helpers.ts';
import AdminUsersPage from '../../src/pages/admin/AdminUsersPage.tsx';

const listUsers = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();
const setUserStatus = vi.fn();
const resetPassword = vi.fn();
const getUserLoginHistory = vi.fn();

vi.mock('../../src/services/admin.service.ts', () => ({
  listUsers: (...args: unknown[]) => listUsers(...args),
  createUser: (...args: unknown[]) => createUser(...args),
  updateUser: (...args: unknown[]) => updateUser(...args),
  setUserStatus: (...args: unknown[]) => setUserStatus(...args),
  resetPassword: (...args: unknown[]) => resetPassword(...args),
  getUserLoginHistory: (...args: unknown[]) => getUserLoginHistory(...args),
}));

function paginated(items: unknown[], page = 1, pageSize = 20, total = items.length) {
  return {
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsers.mockResolvedValue(paginated([
      makeUser({ id: 'u-1', username: 'alice', email: 'alice@example.fr', role: 'USER', status: 'ACTIVE' }),
      makeUser({ id: 'u-2', username: 'bob', email: 'bob@example.fr', role: 'ADMIN', status: 'ACTIVE' }),
    ]));
  });

  it('affiche la liste des utilisateurs', async () => {
    renderPage();
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('ouvre la modale Connexions et affiche la derniere connexion et l historique', async () => {
    getUserLoginHistory.mockResolvedValue(paginated([
      makeLoginHistoryEntry({
        id: 'll-1',
        username: 'alice',
        created_at: '2026-01-02T10:30:00.000Z',
        ip: '203.0.113.9',
        source_port: 54321,
        result: 'SUCCESS',
        access_type: 'ADMIN',
      }),
      makeLoginHistoryEntry({
        id: 'll-2',
        username: 'alice',
        created_at: '2026-01-01T09:00:00.000Z',
        ip: '198.51.100.4',
        source_port: 4444,
        result: 'LOGOUT',
        access_type: 'USER',
      }),
    ], 1, 10));

    renderPage();
    await screen.findByText('alice');

    await userEvent.click(screen.getAllByText('Connexions')[0]);

    await waitFor(() => expect(getUserLoginHistory).toHaveBeenCalledWith('u-1', { page: 1, pageSize: 10 }));
    expect(await screen.findByText(/Connexions de alice/)).toBeInTheDocument();

    expect(screen.getAllByText('203.0.113.9').length).toBeGreaterThan(0);
    expect(screen.getAllByText('54321').length).toBeGreaterThan(0);
    expect(screen.getAllByText('198.51.100.4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4444').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Connexion').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deconnexion').length).toBeGreaterThan(0);
  });

  it('affiche un message d absence de connexion quand l historique est vide', async () => {
    getUserLoginHistory.mockResolvedValue(paginated([], 1, 10));
    renderPage();
    await screen.findByText('alice');

    await userEvent.click(screen.getAllByText('Connexions')[0]);

    expect(await screen.findByText(/Aucune connexion enregistree/)).toBeInTheDocument();
  });

  it('page deja plusieurs pages : navigation Suivant recharge l historique', async () => {
    getUserLoginHistory.mockResolvedValue(paginated([
      makeLoginHistoryEntry({ id: 'll-a', username: 'alice' }),
    ], 1, 10, 15));
    renderPage();
    await screen.findByText('alice');

    await userEvent.click(screen.getAllByText('Connexions')[0]);
    await screen.findByText(/Connexions de alice/);
    await screen.findByText(/Page 1 \/ 2/);

    await userEvent.click(screen.getByText('Suivant'));

    await waitFor(() => expect(getUserLoginHistory).toHaveBeenCalledWith('u-1', { page: 2, pageSize: 10 }));
  });
});
