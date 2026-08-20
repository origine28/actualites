import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listAdminArticles, setArticleStatus, deleteArticle } from '../../services/content.service.ts';
import type { ArticleQuery } from '../../types/content.ts';
import { getApiErrorMessage } from '../../utils/error.ts';
import { formatDate } from '../../utils/format.ts';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-500/20 text-yellow-300',
  PUBLISHED: 'bg-green-500/20 text-green-300',
  ARCHIVED: 'bg-slate-500/20 text-slate-400',
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
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Articles</h1>
          <p className="mt-1 text-sm text-slate-400">Gestion des articles.</p>
        </div>
        <button type="button" onClick={() => navigate('/admin/articles/new')}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400">
          + Nouveau
        </button>
      </div>

      {notice && <p className="mb-4 rounded-md bg-green-500/10 px-4 py-2 text-sm text-green-400">{notice}</p>}
      {error && <p className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); setQuery({ ...query, page: 1 }); }} className="mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Rechercher..." value={query.search ?? ''}
          onChange={(e) => setQuery({ ...query, search: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500" />
        <select value={query.status ?? ''} onChange={(e) => setQuery({ ...query, status: (e.target.value || undefined) as ArticleQuery['status'], page: 1 })}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100">
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publie</option>
          <option value="ARCHIVED">Archive</option>
        </select>
      </form>

      {isPending ? <p className="text-slate-400">Chargement...</p> : articles.length === 0 ? (
        <p className="text-slate-400">Aucun article.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="px-3 py-2">Titre</th>
                <th className="px-3 py-2">Auteur</th>
                <th className="px-3 py-2">Categorie</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Publie le</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-medium text-slate-100">{a.title}</td>
                  <td className="px-3 py-2 text-slate-300">{a.author.username}</td>
                  <td className="px-3 py-2 text-slate-300">{a.category?.name ?? '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[a.status]}`}>{a.status}</span></td>
                  <td className="px-3 py-2 text-slate-400">{formatDate(a.published_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => navigate(`/admin/articles/${a.id}/edit`)}
                        className="text-xs text-amber-400 hover:underline">Modifier</button>
                      {a.status === 'DRAFT' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'PUBLISHED' })}
                          className="text-xs text-green-400 hover:underline">Publier</button>
                      )}
                      {a.status === 'PUBLISHED' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'ARCHIVED' })}
                          className="text-xs text-orange-400 hover:underline">Archiver</button>
                      )}
                      {a.status === 'ARCHIVED' && (
                        <button type="button" onClick={() => statusMutation.mutate({ id: a.id, status: 'PUBLISHED' })}
                          className="text-xs text-green-400 hover:underline">Republier</button>
                      )}
                      <button type="button" onClick={() => { if (confirm('Supprimer cet article ?')) deleteMutation.mutate(a.id); }}
                        className="text-xs text-red-400 hover:underline">Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setQuery({ ...query, page: p })}
              className={`rounded px-3 py-1 text-sm ${p === query.page ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{p}</button>
          ))}
        </div>
      )}
    </section>
  );
}
