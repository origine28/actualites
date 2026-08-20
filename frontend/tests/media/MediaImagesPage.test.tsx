import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeImage } from '../helpers.ts';
import MediaImagesPage from '../../src/pages/admin/MediaImagesPage.tsx';

const listImages = vi.fn();
const uploadImage = vi.fn();
const updateImageAlt = vi.fn();
const deleteImage = vi.fn();

vi.mock('../../src/services/media.service.ts', () => ({
  listImages: (...args: unknown[]) => listImages(...args),
  uploadImage: (...args: unknown[]) => uploadImage(...args),
  updateImageAlt: (...args: unknown[]) => updateImageAlt(...args),
  deleteImage: (...args: unknown[]) => deleteImage(...args),
}));

function paginated(items: unknown[], page = 1, pageSize = 24) {
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
        <MediaImagesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MediaImagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listImages.mockResolvedValue(paginated([makeImage({ id: 'img-1', original_name: 'banniere.png' })]));
  });

  it('affiche la bibliothèque avec les miniatures', async () => {
    renderPage();
    expect(await screen.findByText('banniere.png')).toBeInTheDocument();
    expect(listImages).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 24 });
  });

  it('affiche un message quand la bibliothèque est vide', async () => {
    listImages.mockResolvedValue(paginated([]));
    renderPage();
    expect(await screen.findByText('Aucune image pour le moment.')).toBeInTheDocument();
  });

  it('uploade un fichier et affiche la confirmation', async () => {
    const file = new File(['x'], 'nouvelle.png', { type: 'image/png' });
    uploadImage.mockResolvedValue(makeImage({ id: 'img-2', original_name: 'nouvelle.png' }));
    renderPage();

    await userEvent.upload(screen.getByLabelText('Importer une image'), file);

    await waitFor(() => expect(uploadImage).toHaveBeenCalledWith(file, expect.anything()));
    expect(await screen.findByRole('status')).toHaveTextContent('Image importée avec succès.');
  });

  it('affiche l erreur serveur en cas de fichier refusé', async () => {
    const file = new File(['x'], 'faux.png', { type: 'image/png' });
    uploadImage.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: { code: 'INVALID_IMAGE', message: 'Type de fichier non pris en charge' } } },
    });
    renderPage();

    await userEvent.upload(screen.getByLabelText('Importer une image'), file);

    expect(await screen.findByRole('alert')).toHaveTextContent('Type de fichier non pris en charge');
  });

  it('met à jour le texte alternatif', async () => {
    updateImageAlt.mockResolvedValue(makeImage({ id: 'img-1', alt: 'Photo principale' }));
    renderPage();
    await screen.findByText('banniere.png');

    await userEvent.type(screen.getByLabelText('Texte alternatif'), 'Photo principale');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(updateImageAlt).toHaveBeenCalledWith('img-1', 'Photo principale'));
  });

  it('supprime une image', async () => {
    deleteImage.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('banniere.png');

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith('img-1', expect.anything()));
  });

  it('affiche l erreur quand la suppression est refusée (image utilisée)', async () => {
    deleteImage.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: 'IMAGE_IN_USE', message: 'Image utilisee par du contenu' } } },
    });
    renderPage();
    await screen.findByText('banniere.png');

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Image utilisee par du contenu');
  });
});
