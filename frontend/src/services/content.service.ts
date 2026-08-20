import type { ListResponse } from '../types/api.ts';
import type {
  ArticleQuery,
  ArticleSummaryView,
  ArticleView,
  Category,
  CategoryTreeItem,
  CreateArticleInput,
  CreateCategoryInput,
  CreateTagInput,
  TagQuery,
  TagView,
  UpdateArticleInput,
  UpdateCategoryInput,
} from '../types/content.ts';
import api from './api.ts';

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Public articles
// ---------------------------------------------------------------------------

export async function listPublicArticles(query: ArticleQuery = {}): Promise<ListResponse<ArticleSummaryView>> {
  const { data } = await api.get<ListResponse<ArticleSummaryView>>(`/articles${toQueryString(query)}`);
  return data;
}

export async function getPublicArticle(slug: string): Promise<ArticleView> {
  const { data } = await api.get<{ article: ArticleView }>(`/articles/${encodeURIComponent(slug)}`);
  return data.article;
}

// ---------------------------------------------------------------------------
// Public categories
// ---------------------------------------------------------------------------

export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
  const { data } = await api.get<{ categories: CategoryTreeItem[] }>('/categories/tree');
  return data.categories;
}

// ---------------------------------------------------------------------------
// Admin articles
// ---------------------------------------------------------------------------

export async function listAdminArticles(query: ArticleQuery = {}): Promise<ListResponse<ArticleSummaryView>> {
  const { data } = await api.get<ListResponse<ArticleSummaryView>>(`/admin/articles${toQueryString(query)}`);
  return data;
}

export async function getAdminArticle(id: string): Promise<ArticleView> {
  const { data } = await api.get<{ article: ArticleView }>(`/admin/articles/${id}`);
  return data.article;
}

export async function createArticle(input: CreateArticleInput): Promise<ArticleView> {
  const { data } = await api.post<{ article: ArticleView }>('/admin/articles', input);
  return data.article;
}

export async function updateArticle(id: string, input: UpdateArticleInput): Promise<ArticleView> {
  const { data } = await api.put<{ article: ArticleView }>(`/admin/articles/${id}`, input);
  return data.article;
}

export async function setArticleStatus(id: string, status: string): Promise<ArticleView> {
  const { data } = await api.patch<{ article: ArticleView }>(`/admin/articles/${id}/status`, { status });
  return data.article;
}

export async function deleteArticle(id: string): Promise<void> {
  await api.delete(`/admin/articles/${id}`);
}

// ---------------------------------------------------------------------------
// Admin categories
// ---------------------------------------------------------------------------

export async function listCategoriesAdmin(query?: object): Promise<ListResponse<Category>> {
  const qs = query ? toQueryString(query) : '';
  const { data } = await api.get<ListResponse<Category>>(`/admin/categories${qs}`);
  return data;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const { data } = await api.post<{ category: Category }>('/admin/categories', input);
  return data.category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<Category> {
  const { data } = await api.put<{ category: Category }>(`/admin/categories/${id}`, input);
  return data.category;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/admin/categories/${id}`);
}

// ---------------------------------------------------------------------------
// Admin tags
// ---------------------------------------------------------------------------

export async function listTagsAdmin(query: TagQuery = {}): Promise<ListResponse<TagView>> {
  const { data } = await api.get<ListResponse<TagView>>(`/admin/tags${toQueryString(query)}`);
  return data;
}

export async function createTag(input: CreateTagInput): Promise<TagView> {
  const { data } = await api.post<{ tag: TagView }>('/admin/tags', input);
  return data.tag;
}

export async function deleteTag(id: string): Promise<void> {
  await api.delete(`/admin/tags/${id}`);
}
