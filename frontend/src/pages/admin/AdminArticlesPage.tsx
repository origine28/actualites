import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listAdminArticles, setArticleStatus, deleteArticle } from '../../services/content.service.ts';
import type { ArticleQuery } from '../../types/content.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge-warning',
  PUBLISHED: 'badge-success',
  ARCHIVED: 'badge-neutral',
};

export default function AdminArticlesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState<ArticleQuery>({ page: 1, pageSize: 20 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin-articles', query],
    queryFn: () => listAdminArticles(query),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-articles'] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => setArticleStatus(id, status),
    onSuccess: () => { invalidate(); setNotice('Statut mis a jour.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Erreur de statut')); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => { invalidate(); setNotice('Article supprime.'); setError(null); },
    onError: (err: unknown) => { setNotice(null); setError(getApiErrorMessage(err, 'Suppression impossible')); },
  });

  const articles = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Contenu</p>
          <h1 className="page-title">Articles</h1>
          <p className="page-subtitle mt-1">Gestion des articles.</p>
        </div>
        <button type="button" onClick={() => navigate('/admin/articles/new')} className="btn btn-primary">
          + Nouveau
        </button>
      </div>

      {notice && <p role="status" className="alert alert-success">{notice}</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Rechercher..." value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: 1 })}
          className="input w-56" />
        <select value={query.status ?? ''} onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as ArticleQuery['status'], page: 1 })}
          className="input w-auto">
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publie</option>
          <option value="ARCHIVED">Archive</option>
        </select>
      </form>

      {isPending ? (
        <p className="text-fg-muted">Chargement...</p>
      ) : articles.length === 0 ? (
        <p className="text-fg-muted">Aucun article.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Auteur</th>
                <th>Categorie</th>
                <th>Statut</th>
                <th>Publie le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td>{a.author.username}</td>
                  <td>{a.category?.name ?? '—'}</td>
                  <td><span className={`badge ${STATUS_BADGES[a.status] ?? 'badge-neutral'}`}>{a.status}</span></td>
                  <td className="mono">{formatDate(a.published_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      <button type="button" onClick={() => navigate(`/admin/articles/${a.id}/edit`)}
                        className="cursor-pointer font-semibold text-accent hover:text-accent-strong">Modifier</button>
                      {a.status === 'DRAFT' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'PUBLISHED' })}
                          className="cursor-pointer font-semibold text-success hover:underline">Publier</button>
                      )}
                      {a.status === 'PUBLISHED' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'ARCHIVED' })}
                          className="cursor-pointer font-semibold text-warning hover:underline">Archiver</button>
                      )}
                      {a.status === 'ARCHIVED' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'PUBLISHED' })}
                          className="cursor-pointer font-semibold text-success hover:underline">Republier</button>
                      )}
                      <button type="button" onClick={() => { if (confirm('Supprimer cet article ?')) deleteMutation.mutate(a.id); }}
                        className="cursor-pointer font-semibold text-danger hover:underline">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setQuery({ ...query, page: p })}
              className={`page-btn ${p === query.page ? 'page-btn-active' : ''}`}>{p}</button>
          ))}
        </div>
      )}
    </section>
  );
}