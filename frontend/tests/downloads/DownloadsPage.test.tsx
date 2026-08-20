import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDownload } from '../helpers.ts';
import DownloadsPage from '../../src/pages/DownloadsPage.tsx';

const listPublicDownloads = vi.fn();
const downloadFile = vi.fn();

vi.mock('../../src/services/download.service.ts', () => ({
  listPublicDownloads: (...args: unknown[]) => listPublicDownloads(...args),
  downloadFile: (...args: unknown[]) => downloadFile(...args),
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
        <DownloadsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DownloadsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublicDownloads.mockResolvedValue(paginated([
      makeDownload({ id: 'dl-1', title: 'Guide Utilisateur', type: 'PDF', platform: 'WINDOWS', status: 'PUBLISHED', version: '3.0', size_bytes: 1048576 }),
      makeDownload({ id: 'dl-2', title: 'App Android', type: 'MOBILE', platform: 'ANDROID', status: 'PUBLISHED', version: '1.0', size_bytes: 52428800 }),
    ]));
  });

  it('affiche la liste des telechargements publiés', async () => {
    renderPage();
    expect(await screen.findByText('Guide Utilisateur')).toBeInTheDocument();
    expect(screen.getByText('App Android')).toBeInTheDocument();
    expect(listPublicDownloads).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('affiche les métadonnées : type, plateforme, version, taille', async () => {
    renderPage();
    await screen.findByText('Guide Utilisateur');
    const pdfSpans = screen.getAllByText('PDF');
    const pdfInContent = pdfSpans.find((el) => el.tagName === 'SPAN' && !el.closest('option'));
    expect(pdfInContent).toBeTruthy();
    const winSpans = screen.getAllByText('Windows');
    const winInContent = winSpans.find((el) => el.tagName === 'SPAN' && !el.closest('option'));
    expect(winInContent).toBeTruthy();
    expect(screen.getByText('v3.0')).toBeInTheDocument();
  });

  it('affiche un message quand la liste est vide', async () => {
    listPublicDownloads.mockResolvedValue(paginated([]));
    renderPage();
    expect(await screen.findByText('Aucun telechargement disponible.')).toBeInTheDocument();
  });

  it('déclenche le téléchargement du fichier', async () => {
    downloadFile.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Guide Utilisateur');

    const buttons = screen.getAllByText('Telecharger');
    await userEvent.click(buttons[0]);

    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith('dl-1'));
  });

  it('affiche une erreur en cas d echec du telechargement', async () => {
    downloadFile.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Introuvable' } } },
    });
    renderPage();
    await screen.findByText('Guide Utilisateur');

    const buttons = screen.getAllByText('Telecharger');
    await userEvent.click(buttons[0]);

    expect(await screen.findByText('Introuvable')).toBeInTheDocument();
  });

  it('affiche les filtres et permet de filtrer par type', async () => {
    renderPage();
    await screen.findByText('Guide Utilisateur');

    const typeSelect = screen.getByDisplayValue('Tous les types');
    await userEvent.selectOptions(typeSelect, 'PDF');

    await waitFor(() => {
      expect(listPublicDownloads).toHaveBeenCalledWith(expect.objectContaining({ type: 'PDF', page: 1 }));
    });
  });
});
