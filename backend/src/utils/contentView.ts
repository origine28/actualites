import type { ArticleStatus } from '../generated/prisma/enums.ts';
import { toGalleryItemView, toImageView, type GalleryItemView, type ImageRow, type ImageView } from './mediaView.ts';

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface AuthorRef {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

export interface ArticleView {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  category: CategoryRef | null;
  tags: TagRef[];
  author: AuthorRef;
  status: ArticleStatus;
  source: string | null;
  language: string;
  featured_image: ImageView | null;
  gallery: GalleryItemView[];
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Ligne article telle que retournée par le repository (relations incluses). */
export interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  category_id: string | null;
  featured_image_id: string | null;
  status: ArticleStatus;
  source: string | null;
  language: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  category: CategoryRef | null;
  author: AuthorRef;
  featuredImage: ImageRow | null;
  gallery: Array<{ position: number; image: ImageRow }>;
  tags: Array<{ tag: TagRef }>;
}

/** Sélection publique (liste) : pas de contenu complet, pas de galerie. */
export interface ArticleSummaryRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category_id: string | null;
  featured_image_id: string | null;
  status: ArticleStatus;
  source: string | null;
  language: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  category: CategoryRef | null;
  author: AuthorRef;
  featuredImage: ImageRow | null;
  tags: Array<{ tag: TagRef }>;
}

export function toArticleView(article: ArticleRow): ArticleView {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    content: article.content,
    category: article.category,
    tags: article.tags.map((t) => t.tag),
    author: article.author,
    status: article.status,
    source: article.source,
    language: article.language,
    featured_image: article.featuredImage ? toImageView(article.featuredImage) : null,
    gallery: article.gallery.map(toGalleryItemView),
    published_at: article.published_at,
    created_at: article.created_at,
    updated_at: article.updated_at,
  };
}

export function toArticleSummaryView(article: ArticleSummaryRow): Omit<ArticleView, 'content' | 'gallery'> {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    category: article.category,
    tags: article.tags.map((t) => t.tag),
    author: article.author,
    status: article.status,
    source: article.source,
    language: article.language,
    featured_image: article.featuredImage ? toImageView(article.featuredImage) : null,
    published_at: article.published_at,
    created_at: article.created_at,
    updated_at: article.updated_at,
  };
}
