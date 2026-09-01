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
    <section className="space-y-8">
      <header>
        <p className="kicker">La rédaction</p>
        <h1 className="page-title-lg">Actualités</h1>
        <p className="page-subtitle mt-1">Dernières nouvelles et articles publiés.</p>
      </header>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Rechercher un article…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="input w-64"
        />
        <select
          value={query.category ?? ''}
          onChange={(e) => setQuery((prev) => ({ ...prev, category: e.target.value || undefined, page: 1 }))}
          className="input w-auto"
        >
          <option value="">Toutes les catégories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary">
          Rechercher
        </button>
      </form>

      {isPending && <p className="text-fg-muted">Chargement…</p>}
      {isError && <p className="alert alert-error">Impossible de charger les articles.</p>}
      {!isPending && !isError && articles.length === 0 && (
        <p className="text-fg-muted">Aucun article publié.</p>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <Link
            key={article.id}
            to={`/app/articles/${article.slug}`}
            className="card card-hover block"
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
                <h2 className="truncate font-display text-lg font-bold text-fg">{article.title}</h2>
                {article.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{article.summary}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
                  {article.category && (
                    <span className="badge badge-accent">{article.category.name}</span>
                  )}
                  {article.tags.map((t) => (
                    <span key={t.id} className="badge badge-neutral">{t.name}</span>
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
        <div className="flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuery((prev) => ({ ...prev, page: p }))}
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