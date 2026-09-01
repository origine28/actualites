import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { deleteImage, listImages, updateImageAlt, uploadImage } from '../../services/media.service.ts';
import type { ImageView } from '../../types/media.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate, formatFileSize } from '../../utils/format.ts';

const PAGE_SIZE = 24;

export default function MediaImagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['admin-images', { search, page }],
    queryFn: () => listImages({ search, page, pageSize: PAGE_SIZE }),
  });

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-images'] });

  const uploadMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: () => {
      setNotice('Image importée avec succès.');
      setError(null);
      invalidateList();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, "Import impossible. Vérifiez le format du fichier."));
    },
  });

  const altMutation = useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) => updateImageAlt(id, alt),
    onSuccess: () => invalidateList(),
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, "Mise à jour du texte alternatif impossible."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => invalidateList(),
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, "Suppression impossible. L\u2019image est peut-être utilisée."));
    },
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    uploadMutation.mutate(file, {
      onSettled: () => setUploading(false),
    });
    event.target.value = '';
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleAltSubmit(image: ImageView, value: string) {
    if (value === image.alt) return;
    altMutation.mutate({ id: image.id, alt: value });
  }

  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Médiathèque</p>
          <h1 className="page-title">Bibliothèque d&apos;images</h1>
          <p className="page-subtitle mt-1">
            Les images sont ré-encodées et déclinées en variantes (thumb, medium, large) au moment de l&apos;import.
          </p>
        </div>
        <label className="btn btn-primary inline-flex cursor-pointer items-center">
          {uploading ? 'Import en cours…' : 'Importer une image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      <form onSubmit={handleSearchSubmit} className="flex max-w-sm items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une image…"
          className="input w-full"
        />
        <button type="submit" className="btn btn-secondary">
          Rechercher
        </button>
      </form>

      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="alert alert-success">
          {notice}
        </p>
      )}

      {isPending && <p className="text-fg-muted">Chargement…</p>}
      {isError && <p className="text-danger">Impossible de charger la bibliothèque.</p>}
      {data && data.data.length === 0 && (
        <p className="rounded-md border border-dashed border-edge-strong px-4 py-10 text-center text-fg-muted">
          Aucune image pour le moment.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data?.data.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onDelete={() => deleteMutation.mutate(image.id)}
            onAltSubmit={(value) => handleAltSubmit(image, value)}
          />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`page-btn ${page <= 1 ? 'page-btn-disabled' : ''}`}
          >
            Précédent
          </button>
          <span className="text-fg-muted">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            className={`page-btn ${page >= pagination.totalPages ? 'page-btn-disabled' : ''}`}
          >
            Suivant
          </button>
        </div>
      )}
    </section>
  );
}

interface ImageCardProps {
  image: ImageView;
  onDelete: () => void;
  onAltSubmit: (alt: string) => void;
}

function ImageCard({ image, onDelete, onAltSubmit }: ImageCardProps) {
  const [altDraft, setAltDraft] = useState(image.alt);

  return (
    <article className="overflow-hidden rounded-md border border-edge bg-surface-muted">
      <div className="flex h-36 items-center justify-center bg-inset">
        <img
          src={image.urls.thumb}
          alt={image.alt || image.original_name}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <div className="space-y-2 p-3 text-sm">
        <p className="truncate text-fg" title={image.original_name}>
          {image.original_name}
        </p>
        <p className="text-xs text-fg-muted">
          {image.width} × {image.height} · {formatFileSize(image.size_bytes)} · {formatDate(image.created_at)}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onAltSubmit(altDraft.trim());
          }}
          className="flex gap-1"
        >
          <input
            type="text"
            value={altDraft}
            maxLength={200}
            onChange={(event) => setAltDraft(event.target.value)}
            aria-label="Texte alternatif"
            placeholder="Texte alternatif"
            className="input px-2 py-1 text-xs"
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            OK
          </button>
        </form>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-danger btn-sm w-full"
        >
          Supprimer
        </button>
      </div>
    </article>
  );
}