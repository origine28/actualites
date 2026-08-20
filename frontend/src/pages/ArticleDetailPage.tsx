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
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-400">Chargement...</p>
      </section>
    );
  }

  if (isError || !article) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-400">Article introuvable.</p>
        <Link to="/app/articles" className="mt-4 inline-block text-sm text-amber-400 hover:underline">
          Retour aux articles
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/app/articles" className="mb-4 inline-block text-sm text-amber-400 hover:underline">
        &larr; Retour aux articles
      </Link>

      {article.featured_image && (
        <img
          src={article.featured_image.urls.large}
          alt={article.featured_image.alt || article.title}
          className="mb-6 w-full rounded-lg object-cover"
          style={{ maxHeight: 400 }}
        />
      )}

      <h1 className="mb-3 text-3xl font-bold text-slate-100">{article.title}</h1>

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>{article.author.username}</span>
        {article.published_at && <span>{formatDate(article.published_at)}</span>}
        {article.category && (
          <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-300">{article.category.name}</span>
        )}
        {article.tags.map((t) => (
          <span key={t.id} className="rounded bg-slate-700/50 px-2 py-0.5 text-slate-400">{t.name}</span>
        ))}
      </div>

      {article.summary && (
        <p className="mb-6 text-lg text-slate-300">{article.summary}</p>
      )}

      <div
        className="prose prose-invert max-w-none text-slate-200"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {article.gallery.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Galerie</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {article.gallery.map((item) => (
              <img
                key={item.image.id}
                src={item.image.urls.medium}
                alt={item.image.alt || `Image ${item.position}`}
                className="rounded-lg object-cover"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
