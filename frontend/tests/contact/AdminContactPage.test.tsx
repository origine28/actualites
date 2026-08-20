import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeContactMessage } from '../helpers.ts';
import AdminContactPage from '../../src/pages/admin/AdminContactPage.tsx';

const listContactMessages = vi.fn();
const getContactMessage = vi.fn();
const setContactMessageStatus = vi.fn();
const deleteContactMessage = vi.fn();

vi.mock('../../src/services/contact.service.ts', () => ({
  listContactMessages: (...args: unknown[]) => listContactMessages(...args),
  getContactMessage: (...args: unknown[]) => getContactMessage(...args),
  setContactMessageStatus: (...args: unknown[]) => setContactMessageStatus(...args),
  deleteContactMessage: (...args: unknown[]) => deleteContactMessage(...args),
}));

function paginated(items: unknown[], page = 1, pageSize = 20) {
  return {
    data: items,
    pagination: { page, pageSize, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) },
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminContactPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listContactMessages.mockResolvedValue(paginated([
      makeContactMessage({ id: 'cm-1', subject: 'Question Support', name: 'Alice', status: 'NEW' }),
      makeContactMessage({ id: 'cm-2', subject: 'Bug signale', name: 'Bob', status: 'READ' }),
    ]));
  });

  it('affiche la liste des messages', async () => {
    renderPage();
    expect(await screen.findByText('Question Support')).toBeInTheDocument();
    expect(screen.getByText('Bug signale')).toBeInTheDocument();
    expect(listContactMessages).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('affiche un message quand la liste est vide', async () => {
    listContactMessages.mockResolvedValue(paginated([]));
    renderPage();
    expect(await screen.findByText(/Aucun message/)).toBeInTheDocument();
  });

  it('selectionne un message pour voir le detail', async () => {
    getContactMessage.mockResolvedValue(makeContactMessage({ id: 'cm-1', subject: 'Question Support', message: 'Contenu du message.' }));
    renderPage();
    await screen.findByText('Question Support');

    await userEvent.click(screen.getByText('Question Support'));

    await waitFor(() => expect(getContactMessage).toHaveBeenCalledWith('cm-1'));
    expect(await screen.findByText('Contenu du message.')).toBeInTheDocument();
  });

  it('filtre par statut', async () => {
    renderPage();
    await screen.findByText('Question Support');

    const statusSelect = screen.getByDisplayValue('Tous les statuts');
    await userEvent.selectOptions(statusSelect, 'NEW');

    await waitFor(() => {
      expect(listContactMessages).toHaveBeenCalledWith(expect.objectContaining({ status: 'NEW', page: 1 }));
    });
  });

  it('passe le statut NEW -> READ', async () => {
    getContactMessage.mockResolvedValue(makeContactMessage({ id: 'cm-1', status: 'NEW', message: 'Bonjour, j\'ai une question concernant vos services.' }));
    setContactMessageStatus.mockResolvedValue(makeContactMessage({ id: 'cm-1', status: 'READ' }));
    renderPage();
    await screen.findByText('Question Support');

    await userEvent.click(screen.getByText('Question Support'));
    await screen.findByText('Marquer lu');

    await userEvent.click(screen.getByText('Marquer lu'));

    await waitFor(() => expect(setContactMessageStatus).toHaveBeenCalledWith('cm-1', 'READ'));
  });

  it('erreur API : affiche le message', async () => {
    getContactMessage.mockResolvedValue(makeContactMessage({ id: 'cm-1', message: 'Bonjour, j\'ai une question concernant vos services.' }));
    setContactMessageStatus.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: { code: 'INTERNAL_ERROR', message: 'Erreur interne' } } },
    });
    renderPage();
    await screen.findByText('Question Support');

    await userEvent.click(screen.getByText('Question Support'));
    await screen.findByText('Marquer lu');

    await userEvent.click(screen.getByText('Marquer lu'));

    expect(await screen.findByText('Erreur interne')).toBeInTheDocument();
  });
});
