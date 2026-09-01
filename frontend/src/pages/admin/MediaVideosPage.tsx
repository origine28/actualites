import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { listCategoriesAdmin } from '../../services/content.service.ts';
import { createVideo, deleteVideo, listVideos, setVideoStatus } from '../../services/media.service.ts';
import type { VideoStatus, VideoView } from '../../types/media.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

const PAGE_SIZE = 12;

export default function MediaVideosPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VideoStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['admin-videos', { search, status: statusFilter, page }],
    queryFn: () => listVideos({ search, status: statusFilter || undefined, page, pageSize: PAGE_SIZE }),
  });

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ['admin-videos'] });

  const createMutation = useMutation({
    mutationFn: createVideo,
    onSuccess: () => {
      setNotice('Vidéo ajoutée. Elle est visible uniquement après publication.');
      setError(null);
      invalidateList();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, "Ajout de la vidéo impossible."));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VideoStatus }) => setVideoStatus(id, status),
    onSuccess: () => invalidateList(),
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, "Changement de statut impossible."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => invalidateList(),
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, "Suppression de la vidéo impossible."));
    },
  });

  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <div>
        <p className="kicker">Médiathèque</p>
        <h1 className="page-title">Vidéos</h1>
        <p className="page-subtitle mt-1">
          YouTube et Vimeo uniquement. L&apos;URL fournie est normalisée en URL d&apos;intégration.
        </p>
      </div>

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

      <CreateVideoForm
        onSubmit={(input) =>
          createMutation.mutate(input, {
            onSuccess: () => createMutation.reset(),
          })
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher une vidéo…"
          className="input w-full max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as VideoStatus | '');
            setPage(1);
          }}
          aria-label="Filtrer par statut"
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publiée</option>
          <option value="ARCHIVED">Archivée</option>
        </select>
      </div>

      {isPending && <p className="text-fg-muted">Chargement…</p>}
      {isError && <p className="text-danger">Impossible de charger les vidéos.</p>}
      {data && data.data.length === 0 && (
        <p className="rounded-md border border-dashed border-edge-strong px-4 py-10 text-center text-fg-muted">
          Aucune vidéo pour le moment.
        </p>
      )}

      <div className="space-y-4">
        {data?.data.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onStatus={(status) => statusMutation.mutate({ id: video.id, status })}
            onDelete={() => deleteMutation.mutate(video.id)}
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

function CreateVideoForm({ onSubmit }: { onSubmit: (input: Parameters<typeof createVideo>[0]) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<VideoStatus>('DRAFT');

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: listCategoriesAdmin,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ title, url, category_id: categoryId || null, status });
    setTitle('');
    setUrl('');
    setCategoryId('');
    setStatus('DRAFT');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div className="field sm:col-span-2">
        <label htmlFor="video-title" className="field-label">
          Titre
        </label>
        <input
          id="video-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={200}
          className="input w-full"
        />
      </div>
      <div className="field sm:col-span-2">
        <label htmlFor="video-url" className="field-label">
          URL (YouTube ou Vimeo)
        </label>
        <input
          id="video-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          className="input w-full"
        />
      </div>
      <div className="field">
        <label htmlFor="video-category" className="field-label">
          Catégorie (optionnel)
        </label>
        <select
          id="video-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="input w-full"
        >
          <option value="">Aucune</option>
          {categories?.data.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="video-status" className="field-label">
          Statut initial
        </label>
        <select
          id="video-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as VideoStatus)}
          className="input w-full"
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publiée</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary">
          Ajouter la vidéo
        </button>
      </div>
    </form>
  );
}

const STATUS_LABEL: Record<VideoStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publiée',
  ARCHIVED: 'Archivée',
};

const STATUS_BADGE: Record<VideoStatus, string> = {
  DRAFT: 'badge-neutral',
  PUBLISHED: 'badge-success',
  ARCHIVED: 'badge-warning',
};

function VideoCard({
  video,
  onStatus,
  onDelete,
}: {
  video: VideoView;
  onStatus: (status: VideoStatus) => void;
  onDelete: () => void;
}) {
  return (
    <article className="card flex flex-col gap-4 sm:flex-row">
      <iframe
        src={video.url}
        title={video.title}
        className="aspect-video w-full shrink-0 rounded bg-black sm:w-64"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-display font-bold text-fg">{video.title}</h2>
          <span className="badge badge-neutral">{video.platform}</span>
          <span className={`badge ${STATUS_BADGE[video.status]}`}>
            {STATUS_LABEL[video.status]}
          </span>
        </div>
        {video.description && <p className="line-clamp-2 text-sm text-fg-muted">{video.description}</p>}
        <p className="text-xs text-fg-muted">
          {video.category ? `Catégorie : ${video.category.name} · ` : ''}
          {video.author.username} · {formatDate(video.created_at)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {video.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => onStatus('PUBLISHED')}
              className="btn btn-sm btn-primary"
            >
              Publier
            </button>
          )}
          {video.status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => onStatus('ARCHIVED')}
              className="btn btn-sm btn-secondary"
            >
              Archiver
            </button>
          )}
          {video.status === 'ARCHIVED' && (
            <>
              <button
                type="button"
                onClick={() => onStatus('PUBLISHED')}
                className="btn btn-sm btn-primary"
              >
                Republier
              </button>
              <button
                type="button"
                onClick={() => onStatus('DRAFT')}
                className="btn btn-sm btn-secondary"
              >
                Repasser en brouillon
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-sm btn-danger ml-auto"
          >
            Supprimer
          </button>
        </div>
      </div>
    </article>
  );
}