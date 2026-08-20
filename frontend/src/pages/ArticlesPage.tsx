import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listPublicArticles, getCategoryTree } from '../services/content.service.ts';
import type { ArticleQuery } from '../types/content.ts';
import { formatDate } from '../utils/format.ts';

export default function ArticlesPage() {
  const [query, setQuery] = useState<ArticleQuery>({ page: 1, pageSize: 12 });
  const [searchInput, setSearchInput] = useState('');

  const { data, isPending, isError } = useQuery({
    queryKey: ['public-articles', query],
    queryFn: () => listPublicArticles(query),
  });

  const { data: categories } = useQuery({
    queryKey: ['category-tree'],
    queryFn: getCategoryTree,
  });

  const articles = data?.data ?? [];
  const pagination = data?.pagination;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-slate-100">Actualites</h1>
      <p className="mb-6 text-slate-400">Dernieres nouvelles et articles publies.</p>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher un article..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
        />
        <select
          value={query.category ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, category: e.target.value || undefined, page: 1 }))}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">Toutes les categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">
          Rechercher
        </button>
      </form>

      {isPending && <p className="text-slate-400">Chargement...</p>}
      {isError && <p className="text-red-400">Impossible de charger les articles.</p>}
      {!isPending && !isError && articles.length === 0 && (
        <p className="text-slate-400">Aucun article publie.</p>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/app/articles/${article.slug}`}
            className="block rounded-lg border border-slate-700 bg-slate-800/50 p-5 transition hover:bg-slate-800"
          >
            <div className="flex gap-4">
              {article.featured_image && (
                <img
                  src={article.featured_image.urls.thumb}
                  alt={article.featured_image.alt || article.title}
                  className="h-24 w-24 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-slate-100">{article.title}</h2>
                {article.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{article.summary}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {article.category && <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300">{article.category.name}</span>}
                  {article.tags.map((t) => (
                    <span key={t.id} className="rounded bg-slate-700/50 px-2 py-0.5 text-slate-400">{t.name}</span>
                  ))}
                  <span>{article.author.username}</span>
                  {article.published_at && <span>{formatDate(article.published_at)}</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuery((prev) => ({ ...prev, page: p }))}
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
