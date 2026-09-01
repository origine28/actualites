import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getPublicArticle } from '../services/content.service.ts';
import { formatDate } from '../utils/format.ts';

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isPending, isError } = useQuery({
    queryKey: ['public-article', slug],
    queryFn: () => getPublicArticle(slug!),
    enabled: !!slug,
  });

  if (isPending) {
    return (
      <section className="mx-auto max-w-3xl">
        <p className="text-fg-muted">Chargement…</p>
      </section>
    );
  }

  if (isError || !article) {
    return (
      <section className="mx-auto max-w-3xl">
        <p className="alert alert-error">Article introuvable.</p>
        <Link to="/app/articles" className="link mt-4 inline-block">
          Retour aux articles
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/app/articles" className="link inline-flex items-center gap-1">
        &larr; Retour aux articles
      </Link>

      {article.featured_image && (
        <img
          src={article.featured_image.urls.large}
          alt={article.featured_image.alt || article.title}
          className="w-full rounded-lg object-cover"
          style={{ maxHeight: 400 }}
        />
      )}

      <header className="space-y-3">
        {article.category && (
          <span className="badge badge-accent">{article.category.name}</span>
        )}
        <h1 className="page-title-lg">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span className="font-medium text-fg-secondary">{article.author.username}</span>
          {article.published_at && <span>{formatDate(article.published_at)}</span>}
          {article.tags.map((t) => (
            <span key={t.id} className="badge badge-neutral">{t.name}</span>
          ))}
        </div>
      </header>

      {article.summary && (
        <p className="text-lg leading-relaxed text-fg-secondary">{article.summary}</p>
      )}

      <div className="article-body" dangerouslySetInnerHTML={{ __html: article.content }} />

      {article.gallery.length > 0 && (
        <div className="pt-4">
          <h2 className="mb-4 font-display text-xl font-bold text-fg">Galerie</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {article.gallery.map((item) => (
              <img
                key={item.image.id}
                src={item.image.urls.medium}
                alt={item.image.alt || `Image ${item.position}`}
                className="rounded object-cover"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}