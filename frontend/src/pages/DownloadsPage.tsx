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
const TYPE_GLYPH: Record<DownloadType, string> = { PDF: 'P', MOBILE: 'M', DESKTOP: 'D' };

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
    <section className="space-y-8">
      <header>
        <p className="kicker">Ressources</p>
        <h1 className="page-title-lg">Téléchargements</h1>
        <p className="page-subtitle mt-1">PDF, applications et documents à télécharger.</p>
      </header>

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
          value={query.type ?? ''}
          onChange={(e) => setQuery({ ...query, type: (e.target.value || undefined) as DownloadQuery['type'], page: 1 })}
          className="input w-auto"
        >
          <option value="">Tous les types</option>
          <option value="PDF">PDF</option>
          <option value="MOBILE">Mobile</option>
          <option value="DESKTOP">Desktop</option>
        </select>
        <select
          value={query.platform ?? ''}
          onChange={(e) => setQuery({ ...query, platform: (e.target.value || undefined) as DownloadQuery['platform'], page: 1 })}
          className="input w-auto"
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
        <p className="text-fg-muted">Chargement...</p>
      ) : downloads.length === 0 ? (
        <p className="text-fg-muted">Aucun telechargement disponible.</p>
      ) : (
        <div className="space-y-3">
          {downloads.map((d) => (
            <div
              key={d.id}
              className="card card-hover flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent-soft font-mono text-lg font-bold text-accent">
                  {TYPE_GLYPH[d.type]}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-fg">{d.title}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
                    <span>{TYPE_LABELS[d.type]}</span>
                    <span>{PLATFORM_LABELS[d.platform]}</span>
                    {d.version && <span>v{d.version}</span>}
                    <span>{formatFileSize(d.size_bytes)}</span>
                    {d.published_at && <span>{formatDate(d.published_at)}</span>}
                  </div>
                  {d.description && (
                    <p className="mt-1 max-w-xl text-sm text-fg-secondary">{d.description}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadMutation.mutate(d.id)}
                disabled={downloadMutation.isPending}
                className="btn btn-primary shrink-0"
              >
                {downloadMutation.isPending ? '...' : 'Telecharger'}
              </button>
            </div>
          ))}
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
    </section>
  );
}