import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDownload, makeDownloadCategory } from '../helpers.ts';
import AdminDownloadsPage from '../../src/pages/admin/AdminDownloadsPage.tsx';

const listDownloads = vi.fn();
const listDownloadCategories = vi.fn();
const createDownload = vi.fn();
const updateDownload = vi.fn();
const setDownloadStatus = vi.fn();
const deleteDownload = vi.fn();
const replaceDownloadFile = vi.fn();

vi.mock('../../src/services/download.service.ts', () => ({
  listDownloads: (...args: unknown[]) => listDownloads(...args),
  listDownloadCategories: (...args: unknown[]) => listDownloadCategories(...args),
  createDownload: (...args: unknown[]) => createDownload(...args),
  updateDownload: (...args: unknown[]) => updateDownload(...args),
  setDownloadStatus: (...args: unknown[]) => setDownloadStatus(...args),
  deleteDownload: (...args: unknown[]) => deleteDownload(...args),
  replaceDownloadFile: (...args: unknown[]) => replaceDownloadFile(...args),
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
        <AdminDownloadsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminDownloadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDownloads.mockResolvedValue(paginated([
      makeDownload({ id: 'dl-1', title: 'Guide PDF', type: 'PDF', platform: 'WINDOWS', status: 'DRAFT' }),
    ]));
    listDownloadCategories.mockResolvedValue(paginated([makeDownloadCategory({ id: 'cat-1', name: 'Apps' })], 1, 50));
  });

  it('affiche la liste des telechargements', async () => {
    renderPage();
    expect(await screen.findByText('Guide PDF')).toBeInTheDocument();
    expect(listDownloads).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('affiche un message quand la liste est vide', async () => {
    listDownloads.mockResolvedValue(paginated([]));
    renderPage();
    expect(await screen.findByText(/Aucun telechargement/)).toBeInTheDocument();
  });

  it('ouvre le formulaire de creation', async () => {
    renderPage();
    await screen.findByText('Guide PDF');
    await userEvent.click(screen.getByText(/\+\s*Nouveau/));
    expect(screen.getByText('Nouveau telechargement')).toBeInTheDocument();
  });

  it('cree un telechargement via le formulaire', async () => {
    const file = new File(['%PDF-1.4 test'], 'guide.pdf', { type: 'application/pdf' });
    createDownload.mockResolvedValue(makeDownload({ id: 'dl-new', title: 'Nouveau Guide' }));
    renderPage();
    await screen.findByText('Guide PDF');

    await userEvent.click(screen.getByText(/\+\s*Nouveau/));

    await userEvent.type(screen.getByPlaceholderText('Titre'), 'Nouveau Guide');

    const fileInput = screen.getByLabelText('Fichier') as HTMLInputElement;
    await userEvent.upload(fileInput, file);
    expect(fileInput.files).toHaveLength(1);

    fireEvent.submit(screen.getByRole('button', { name: 'Creer' }));

    await waitFor(() => expect(createDownload).toHaveBeenCalled());
  });

  it('supprime un telechargement apres confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteDownload.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Guide PDF');

    await userEvent.click(screen.getByText('Supprimer'));

    await waitFor(() => expect(deleteDownload).toHaveBeenCalledWith('dl-1'));
  });

  it('publie un telechargement DRAFT', async () => {
    setDownloadStatus.mockResolvedValue(makeDownload({ id: 'dl-1', status: 'PUBLISHED' }));
    renderPage();
    await screen.findByText('Guide PDF');

    await userEvent.click(screen.getByText('Publier'));

    await waitFor(() => expect(setDownloadStatus).toHaveBeenCalledWith('dl-1', 'PUBLISHED'));
  });
});
