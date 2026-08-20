import type { ListQuery } from './api.ts';
import type { ImageView } from './media.ts';

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface AuthorRef {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  status: CategoryStatus;
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleSummaryView {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  category: CategoryRef | null;
  tags: TagRef[];
  author: AuthorRef;
  status: ArticleStatus;
  source: string | null;
  language: string;
  featured_image: ImageView | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleView extends ArticleSummaryView {
  content: string;
  gallery: Array<{ position: number; image: ImageView }>;
}

export interface ArticleQuery extends ListQuery {
  status?: ArticleStatus;
  category_id?: string;
  category?: string;
  tag?: string;
  author_id?: string;
  from?: string;
  to?: string;
  sort?: 'created_at' | 'updated_at' | 'published_at' | 'title';
}

export interface CreateArticleInput {
  title: string;
  summary?: string | null;
  content: string;
  category_id?: string | null;
  tags?: string[];
  source?: string | null;
  language?: string;
  status?: ArticleStatus;
  published_at?: string | null;
}

export interface UpdateArticleInput {
  title?: string;
  summary?: string | null;
  content?: string;
  category_id?: string | null;
  tags?: string[];
  source?: string | null;
  language?: string;
  status?: ArticleStatus;
  published_at?: string | null;
}

export interface TagView {
  id: string;
  name: string;
  slug: string;
  articles_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagQuery extends ListQuery {
  sort?: 'name' | 'created_at';
}

export interface CreateTagInput {
  name: string;
}

export interface CategoryTreeItem extends Category {
  children: CategoryTreeItem[];
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parent_id?: string | null;
  sort_order?: number;
  status?: CategoryStatus;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  parent_id?: string | null;
  sort_order?: number;
  status?: CategoryStatus;
}
