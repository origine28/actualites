import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeVideo } from '../helpers.ts';
import MediaVideosPage from '../../src/pages/admin/MediaVideosPage.tsx';

const listVideos = vi.fn();
const createVideo = vi.fn();
const setVideoStatus = vi.fn();
const deleteVideo = vi.fn();
const listCategoriesAdmin = vi.fn();

vi.mock('../../src/services/media.service.ts', () => ({
  listVideos: (...args: unknown[]) => listVideos(...args),
  createVideo: (...args: unknown[]) => createVideo(...args),
  setVideoStatus: (...args: unknown[]) => setVideoStatus(...args),
  deleteVideo: (...args: unknown[]) => deleteVideo(...args),
}));

vi.mock('../../src/services/content.service.ts', () => ({
  listCategoriesAdmin: (...args: unknown[]) => listCategoriesAdmin(...args),
}));

function paginated(items: unknown[], page = 1, pageSize = 12) {
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
        <MediaVideosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MediaVideosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVideos.mockResolvedValue(paginated([makeVideo({ id: 'vid-1', title: 'Vidéo phare' })]));
    listCategoriesAdmin.mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } });
  });

  it('affiche la liste des vidéos avec leur statut', async () => {
    renderPage();
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Vidéo phare')).toBeInTheDocument();
    expect(within(card).getByText('YOUTUBE')).toBeInTheDocument();
    expect(within(card).getByText('Brouillon')).toBeInTheDocument();
  });

  it('crée une vidéo via le formulaire', async () => {
    createVideo.mockResolvedValue(makeVideo({ id: 'vid-2', title: 'Nouvelle vidéo' }));
    renderPage();

    await userEvent.type(screen.getByLabelText('Titre'), 'Nouvelle vidéo');
    await userEvent.type(
      screen.getByLabelText('URL (YouTube ou Vimeo)'),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    await userEvent.selectOptions(screen.getByLabelText('Statut initial'), 'PUBLISHED');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la vidéo' }));

    await waitFor(() =>
      expect(createVideo).toHaveBeenCalledWith(
        {
          title: 'Nouvelle vidéo',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          category_id: null,
          status: 'PUBLISHED',
        },
        expect.anything(),
      ),
    );
  });

  it('affiche l erreur serveur si la création échoue', async () => {
    createVideo.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: { code: 'INVALID_VIDEO_URL', message: 'URL video non prise en charge' } } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('Titre'), 'Invalide');
    await userEvent.type(screen.getByLabelText('URL (YouTube ou Vimeo)'), 'https://example.com/x');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter la vidéo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('URL video non prise en charge');
  });

  it('publie une vidéo en brouillon', async () => {
    setVideoStatus.mockResolvedValue(makeVideo({ id: 'vid-1', status: 'PUBLISHED' }));
    renderPage();
    await screen.findByRole('article');

    await userEvent.click(screen.getByRole('button', { name: 'Publier' }));

    await waitFor(() => expect(setVideoStatus).toHaveBeenCalledWith('vid-1', 'PUBLISHED'));
  });

  it('affiche les actions de républication pour une vidéo archivée', async () => {
    listVideos.mockResolvedValue(paginated([makeVideo({ id: 'vid-1', title: 'Vidéo archivée', status: 'ARCHIVED' })]));
    renderPage();
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Vidéo archivée')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Republier' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Repasser en brouillon' })).toBeInTheDocument();
  });

  it('supprime une vidéo', async () => {
    deleteVideo.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole('article');

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteVideo).toHaveBeenCalledWith('vid-1', expect.anything()));
  });

  it('filtre par statut', async () => {
    renderPage();
    await screen.findByText('Vidéo phare');

    await userEvent.selectOptions(screen.getByLabelText('Filtrer par statut'), 'PUBLISHED');

    await waitFor(() =>
      expect(listVideos).toHaveBeenCalledWith({ search: '', status: 'PUBLISHED', page: 1, pageSize: 12 }),
    );
  });
});
