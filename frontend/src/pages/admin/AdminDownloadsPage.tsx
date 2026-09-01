import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDownloads,
  listDownloadCategories,
  createDownload,
  updateDownload,
  setDownloadStatus,
  deleteDownload,
  replaceDownloadFile,
} from '../../services/download.service.ts';
import type {
  DownloadView,
  DownloadQuery,
  DownloadType,
  DownloadPlatform,
  CreateDownloadInput,
  DownloadCategoryView,
} from '../../types/download.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatFileSize, formatDate } from '../../utils/format.ts';

const TYPE_LABELS: Record<DownloadType, string> = { PDF: 'PDF', MOBILE: 'Mobile', DESKTOP: 'Desktop' };
const PLATFORM_LABELS: Record<DownloadPlatform, string> = {
  ANDROID: 'Android', IOS: 'iOS', WINDOWS: 'Windows', LINUX: 'Linux', MACOS: 'macOS', OTHER: 'Autre',
};
const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-warning',
  PUBLISHED: 'badge-success',
  ARCHIVED: 'badge-neutral',
};

export default function AdminDownloadsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState<DownloadQuery>({ page: 1, pageSize: 20 });
  const [showForm, setShowForm] = useState(false);
  const [editingDownload, setEditingDownload] = useState<DownloadView | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-downloads', query],
    queryFn: () => listDownloads(query),
  });

  const { data: categories } = useQuery({
    queryKey: ['admin-download-categories'],
    queryFn: listDownloadCategories,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-downloads'] });

  const createMutation = useMutation({
    mutationFn: ({ file, input }: { file: File; input: CreateDownloadInput }) => createDownload(file, input),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setNotice('Telechargement cree.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Erreur lors de la creation'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) => updateDownload(id, input as Parameters<typeof updateDownload>[1]),
    onSuccess: () => {
      invalidate();
      setEditingDownload(null);
      setNotice('Telechargement mis a jour.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Erreur lors de la mise a jour'));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setDownloadStatus(id, status),
    onSuccess: () => {
      invalidate();
      setNotice('Statut mis a jour.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Erreur de statut'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDownload(id),
    onSuccess: () => {
      invalidate();
      setNotice('Telechargement supprime.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Suppression impossible'));
    },
  });

  const replaceMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => replaceDownloadFile(id, file),
    onSuccess: () => {
      invalidate();
      setReplaceId(null);
      setNotice('Fichier remplace.');
      setError(null);
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(getApiErrorMessage(err, 'Remplacement impossible'));
    },
  });

  const downloads = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Ressources</p>
          <h1 className="page-title">Telechargements</h1>
          <p className="page-subtitle mt-1">
            PDF, applications mobiles et desktop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingDownload(null); setShowForm(true); setError(null); setNotice(null); }}
          className="btn btn-primary"
        >
          + Nouveau
        </button>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      {/* Filtres */}
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Rechercher..."
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          className="input w-56"
        />
        <select
          value={query.status ?? ''}
          onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as DownloadQuery['status'], page: 1 })}
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publie</option>
          <option value="ARCHIVED">Archive</option>
        </select>
        <select
          value={query.type ?? ''}
          onChange={(e) => setQuery({ ...query, type: (e.target.value || undefined) as DownloadQuery['type'], page: 1 })}
          className="input w-auto"
        >
          <option value="">Tous les types</option>
          <option value="PDF">PDF</option>
          <option value="MOBILE">Mobile</option>
          <option value="DESKTOP">Desktop</option>
        </select>
      </form>

      {/* Tableau */}
      {isPending ? (
        <p className="text-fg-muted">Chargement...</p>
      ) : downloads.length === 0 ? (
        <p className="text-fg-muted">Aucun telechargement.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Type</th>
                <th>Plateforme</th>
                <th>Version</th>
                <th>Taille</th>
                <th>Statut</th>
                <th>Cree le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="font-semibold text-fg">{d.title}</div>
                    <div className="text-xs text-fg-muted">{d.original_name}</div>
                  </td>
                  <td>{TYPE_LABELS[d.type]}</td>
                  <td>{PLATFORM_LABELS[d.platform]}</td>
                  <td>{d.version ?? '—'}</td>
                  <td>{formatFileSize(d.size_bytes)}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGES[d.status] ?? 'badge-neutral'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="mono">{formatDate(d.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => { setEditingDownload(d); setShowForm(true); setError(null); setNotice(null); }}
                        className="cursor-pointer font-semibold text-accent hover:text-accent-strong"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplaceId(replaceId === d.id ? null : d.id)}
                        className="cursor-pointer font-semibold text-info hover:underline"
                      >
                        Remplacer
                      </button>
                      {d.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'PUBLISHED' })}
                          className="cursor-pointer font-semibold text-success hover:underline"
                        >
                          Publier
                        </button>
                      )}
                      {d.status === 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'ARCHIVED' })}
                          className="cursor-pointer font-semibold text-warning hover:underline"
                        >
                          Archiver
                        </button>
                      )}
                      {d.status === 'ARCHIVED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'PUBLISHED' })}
                          className="cursor-pointer font-semibold text-success hover:underline"
                        >
                          Republier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (confirm('Supprimer ce telechargement ?')) deleteMutation.mutate(d.id); }}
                        className="cursor-pointer font-semibold text-danger hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                    {replaceId === d.id && (
                      <div className="mt-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) replaceMutation.mutate({ id: d.id, file });
                          }}
                          className="text-xs text-fg-muted"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuery({ ...query, page: p })}
              className={`page-btn ${p === query.page ? 'page-btn-active' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Formulaire modal */}
      {showForm && (
        <DownloadForm
          categories={categories?.data ?? []}
          editing={editingDownload}
          onSubmit={(file, input) => {
            if (editingDownload) {
              updateMutation.mutate({ id: editingDownload.id, input: input as unknown as Record<string, unknown> });
            } else if (file) {
              createMutation.mutate({ file, input });
            }
          }}
          onClose={() => { setShowForm(false); setEditingDownload(null); }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </section>
  );
}

function DownloadForm({
  categories,
  editing,
  onSubmit,
  onClose,
  isPending,
}: {
  categories: DownloadCategoryView[];
  editing: DownloadView | null;
  onSubmit: (file: File | null, input: CreateDownloadInput) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [type, setType] = useState<DownloadType>(editing?.type ?? 'PDF');
  const [platform, setPlatform] = useState<DownloadPlatform>(editing?.platform ?? 'WINDOWS');
  const [version, setVersion] = useState(editing?.version ?? '');
  const [categoryId, setCategoryId] = useState(editing?.download_category_id ?? '');
  const [file, setFile] = useState<File | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && !file) return;
    onSubmit(file, {
      title,
      description: description || null,
      type,
      platform,
      version: version || null,
      download_category_id: categoryId || null,
    });
  }

  return (
    <div className="modal-overlay">
      <form
        onSubmit={handleSubmit}
        className="modal-panel max-w-lg"
      >
        <h2 className="mb-4 font-display text-lg font-bold text-fg">
          {editing ? 'Modifier le telechargement' : 'Nouveau telechargement'}
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input w-full"
          />
          <textarea
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input w-full"
          />
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as DownloadType)} className="input flex-1">
              <option value="PDF">PDF</option>
              <option value="MOBILE">Mobile</option>
              <option value="DESKTOP">Desktop</option>
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as DownloadPlatform)} className="input flex-1">
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
              <option value="WINDOWS">Windows</option>
              <option value="LINUX">Linux</option>
              <option value="MACOS">macOS</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Version (optionnel)"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="input w-full"
          />
          {categories.length > 0 && (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input w-full">
              <option value="">Sans categorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {!editing && (
            <div className="field">
              <label htmlFor="download-file" className="field-label">Fichier</label>
              <input
                id="download-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-sm text-fg-muted"
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? 'Envoi...' : editing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  );
}