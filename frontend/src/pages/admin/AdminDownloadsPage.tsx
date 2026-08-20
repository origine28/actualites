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
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300',
  PUBLISHED: 'bg-green-500/20 text-green-300',
  ARCHIVED: 'bg-slate-500/20 text-slate-400',
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
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Telechargements</h1>
          <p className="mt-1 text-sm text-slate-400">
            PDF, applications mobiles et desktop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingDownload(null); setShowForm(true); setError(null); setNotice(null); }}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
        >
          + Nouveau
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      {/* Filtres */}
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        />
        <select
          value={query.status ?? ''}
          onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as DownloadQuery['status'], page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publie</option>
          <option value="ARCHIVED">Archive</option>
        </select>
        <select
          value={query.type ?? ''}
          onChange={(e) => setQuery({ ...query, type: (e.target.value || undefined) as DownloadQuery['type'], page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Tous les types</option>
          <option value="PDF">PDF</option>
          <option value="MOBILE">Mobile</option>
          <option value="DESKTOP">Desktop</option>
        </select>
      </form>

      {/* Tableau */}
      {isPending ? (
        <p className="text-slate-400">Chargement...</p>
      ) : downloads.length === 0 ? (
        <p className="text-slate-400">Aucun telechargement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="px-3 py-2">Titre</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Plateforme</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Taille</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Cree le</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((d) => (
                <tr key={d.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{d.title}</div>
                    <div className="text-xs text-slate-500">{d.original_name}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{TYPE_LABELS[d.type]}</td>
                  <td className="px-3 py-2 text-slate-300">{PLATFORM_LABELS[d.platform]}</td>
                  <td className="px-3 py-2 text-slate-300">{d.version ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-300">{formatFileSize(d.size_bytes)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(d.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingDownload(d); setShowForm(true); setError(null); setNotice(null); }}
                        className="text-xs text-amber-400 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplaceId(replaceId === d.id ? null : d.id)}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Remplacer
                      </button>
                      {d.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'PUBLISHED' })}
                          className="text-xs text-green-400 hover:underline"
                        >
                          Publier
                        </button>
                      )}
                      {d.status === 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'ARCHIVED' })}
                          className="text-xs text-orange-400 hover:underline"
                        >
                          Archiver
                        </button>
                      )}
                      {d.status === 'ARCHIVED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: d.id, status: 'PUBLISHED' })}
                          className="text-xs text-green-400 hover:underline"
                        >
                          Republier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (confirm('Supprimer ce telechargement ?')) deleteMutation.mutate(d.id); }}
                        className="text-xs text-red-400 hover:underline"
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
                          className="text-xs text-slate-400"
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
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuery({ ...query, page: p })}
              className={`rounded px-3 py-1 text-sm ${p === query.page ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-slate-800 p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-amber-400">
          {editing ? 'Modifier le telechargement' : 'Nouveau telechargement'}
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          <textarea
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value as DownloadType)} className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
              <option value="PDF">PDF</option>
              <option value="MOBILE">Mobile</option>
              <option value="DESKTOP">Desktop</option>
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as DownloadPlatform)} className="flex-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
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
            className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          {categories.length > 0 && (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100">
              <option value="">Sans categorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {!editing && (
            <div>
              <label htmlFor="download-file" className="mb-1 block text-sm text-slate-400">Fichier</label>
              <input
                id="download-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-sm text-slate-400"
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {isPending ? 'Envoi...' : editing ? 'Mettre a jour' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  );
}
