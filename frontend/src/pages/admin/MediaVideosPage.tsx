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
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-amber-400">Vidéos</h1>
        <p className="mt-1 text-sm text-slate-400">
          YouTube et Vimeo uniquement. L&apos;URL fournie est normalisée en URL d&apos;intégration.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 rounded-md bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher une vidéo…"
          className="w-full max-w-xs rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as VideoStatus | '');
            setPage(1);
          }}
          aria-label="Filtrer par statut"
          className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publiée</option>
          <option value="ARCHIVED">Archivée</option>
        </select>
      </div>

      {isPending && <p className="text-slate-400">Chargement…</p>}
      {isError && <p className="text-red-400">Impossible de charger les vidéos.</p>}
      {data && data.data.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-700 px-4 py-10 text-center text-slate-500">
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
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-slate-400">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
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
      className="mb-8 grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor="video-title" className="mb-1 block text-sm text-slate-300">
          Titre
        </label>
        <input
          id="video-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={200}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="video-url" className="mb-1 block text-sm text-slate-300">
          URL (YouTube ou Vimeo)
        </label>
        <input
          id="video-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          type="url"
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="video-category" className="mb-1 block text-sm text-slate-300">
          Catégorie (optionnel)
        </label>
        <select
          id="video-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Aucune</option>
          {categories?.data.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="video-status" className="mb-1 block text-sm text-slate-300">
          Statut initial
        </label>
        <select
          id="video-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as VideoStatus)}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publiée</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
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

const STATUS_CLASS: Record<VideoStatus, string> = {
  DRAFT: 'bg-slate-600/40 text-slate-300',
  PUBLISHED: 'bg-emerald-500/20 text-emerald-300',
  ARCHIVED: 'bg-amber-500/20 text-amber-300',
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
    <article className="flex flex-col gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4 sm:flex-row">
      <iframe
        src={video.url}
        title={video.title}
        className="aspect-video w-full shrink-0 rounded bg-black sm:w-64"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-semibold text-slate-100">{video.title}</h2>
          <span className="rounded bg-slate-600/40 px-2 py-0.5 text-xs text-slate-300">{video.platform}</span>
          <span className={`rounded px-2 py-0.5 text-xs ${STATUS_CLASS[video.status]}`}>
            {STATUS_LABEL[video.status]}
          </span>
        </div>
        {video.description && <p className="line-clamp-2 text-sm text-slate-400">{video.description}</p>}
        <p className="text-xs text-slate-500">
          {video.category ? `Catégorie : ${video.category.name} · ` : ''}
          {video.author.username} · {formatDate(video.created_at)}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {video.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => onStatus('PUBLISHED')}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Publier
            </button>
          )}
          {video.status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => onStatus('ARCHIVED')}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
            >
              Archiver
            </button>
          )}
          {video.status === 'ARCHIVED' && (
            <>
              <button
                type="button"
                onClick={() => onStatus('PUBLISHED')}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Republier
              </button>
              <button
                type="button"
                onClick={() => onStatus('DRAFT')}
                className="rounded-md bg-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-500"
              >
                Repasser en brouillon
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
          >
            Supprimer
          </button>
        </div>
      </div>
    </article>
  );
}
