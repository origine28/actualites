import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { listPublicDownloads, downloadFile } from '../services/download.service.ts';
import type { DownloadQuery, DownloadType, DownloadPlatform } from '../types/download.ts';
import { getApiErrorMessage } from '../utils/error.ts';
import { formatFileSize, formatDate } from '../utils/format.ts';

const TYPE_LABELS: Record<DownloadType, string> = { PDF: 'PDF', MOBILE: 'Mobile', DESKTOP: 'Desktop' };
const PLATFORM_LABELS: Record<DownloadPlatform, string> = {
  ANDROID: 'Android', IOS: 'iOS', WINDOWS: 'Windows', LINUX: 'Linux', MACOS: 'macOS', OTHER: 'Autre',
};
const TYPE_ICONS: Record<DownloadType, string> = { PDF: '📄', MOBILE: '📱', DESKTOP: '🖥️' };

export default function DownloadsPage() {
  const [query, setQuery] = useState<DownloadQuery>({ page: 1, pageSize: 20 });
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['public-downloads', query],
    queryFn: () => listPublicDownloads(query),
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => downloadFile(id),
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Erreur lors du telechargement'));
    },
    onSuccess: () => setError(null),
  });

  const downloads = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">Telechargements</h1>
      <p className="mb-6 text-slate-400">PDF, applications et documents a telecharger.</p>

      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      {/* Filtres */}
      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        />
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
        <select
          value={query.platform ?? ''}
          onChange={(e) => setQuery({ ...query, platform: (e.target.value || undefined) as DownloadQuery['platform'], page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Toutes les plateformes</option>
          <option value="ANDROID">Android</option>
          <option value="IOS">iOS</option>
          <option value="WINDOWS">Windows</option>
          <option value="LINUX">Linux</option>
          <option value="MACOS">macOS</option>
        </select>
      </form>

      {isPending ? (
        <p className="text-slate-400">Chargement...</p>
      ) : downloads.length === 0 ? (
        <p className="text-slate-400">Aucun telechargement disponible.</p>
      ) : (
        <div className="space-y-3">
          {downloads.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4 hover:bg-slate-800"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{TYPE_ICONS[d.type]}</span>
                <div>
                  <h3 className="font-medium text-slate-100">{d.title}</h3>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>{TYPE_LABELS[d.type]}</span>
                    <span>{PLATFORM_LABELS[d.platform]}</span>
                    {d.version && <span>v{d.version}</span>}
                    <span>{formatFileSize(d.size_bytes)}</span>
                    {d.published_at && <span>{formatDate(d.published_at)}</span>}
                  </div>
                  {d.description && (
                    <p className="mt-1 max-w-xl text-sm text-slate-500">{d.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadMutation.mutate(d.id)}
                disabled={downloadMutation.isPending}
                className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50"
              >
                {downloadMutation.isPending ? '...' : 'Telecharger'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
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
    </section>
  );
}
