import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { ArticleService } from '../services/article.service.ts';
import type { CategoryService } from '../services/category.service.ts';
import type { TagService } from '../services/tag.service.ts';
import { ApiError } from '../utils/errors.ts';
import { idParamSchema } from '../validators/user.validators.ts';
import {
  adminArticleQuerySchema,
  articleStatusTransitionSchema,
  categoryQuerySchema,
  createArticleSchema,
  createCategorySchema,
  createTagSchema,
  publicArticleQuerySchema,
  slugParamSchema,
  tagQuerySchema,
  updateArticleSchema,
  updateCategorySchema,
} from '../validators/content.validators.ts';

export interface ContentControllerConfig {
  articleService: ArticleService;
  categoryService: CategoryService;
  tagService: TagService;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Requete invalide');
  }
  return parsed.data;
}

function requireActor(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentification requise');
  }
  return req.auth.user;
}

function requireContentId(req: Request): string {
  const parsed = idParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    throw new ApiError(404, 'NOT_FOUND', 'Ressource introuvable');
  }
  return parsed.data;
}

function clientInfo(req: Request) {
  return req.clientInfo ?? { ip: 'unknown', sourcePort: null, userAgent: '' };
}

export function createContentController(cfg: ContentControllerConfig) {
  // -------------------------------------------------------------------------
  // Catégories (ADMIN)
  // -------------------------------------------------------------------------
  async function listCategories(req: Request, res: Response): Promise<void> {
    const query = parse(categoryQuerySchema, req.query);
    res.json(await cfg.categoryService.listAdmin(query));
  }

  async function createCategory(req: Request, res: Response): Promise<void> {
    const data = parse(createCategorySchema, req.body);
    const category = await cfg.categoryService.create(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ category });
  }

  async function updateCategory(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    const data = parse(updateCategorySchema, req.body);
    const category = await cfg.categoryService.update(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ category });
  }

  async function deleteCategory(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    await cfg.categoryService.remove(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // Catégories (public)
  // -------------------------------------------------------------------------
  async function listCategoryTree(_req: Request, res: Response): Promise<void> {
    const tree = await cfg.categoryService.listUserTree();
    res.json({ categories: tree });
  }

  // -------------------------------------------------------------------------
  // Tags (ADMIN)
  // -------------------------------------------------------------------------
  async function listTags(req: Request, res: Response): Promise<void> {
    const query = parse(tagQuerySchema, req.query);
    res.json(await cfg.tagService.list(query));
  }

  async function createTag(req: Request, res: Response): Promise<void> {
    const data = parse(createTagSchema, req.body);
    const tag = await cfg.tagService.create(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ tag });
  }

  async function deleteTag(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    await cfg.tagService.remove(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // Articles (ADMIN)
  // -------------------------------------------------------------------------
  async function listAdminArticles(req: Request, res: Response): Promise<void> {
    const query = parse(adminArticleQuerySchema, req.query);
    res.json(await cfg.articleService.listAdmin(query));
  }

  async function getAdminArticle(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    const article = await cfg.articleService.getAdminArticle(id);
    res.json({ article });
  }

  async function createArticle(req: Request, res: Response): Promise<void> {
    const data = parse(createArticleSchema, req.body);
    const article = await cfg.articleService.createArticle(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      data,
    );
    res.status(201).json({ article });
  }

  async function updateArticle(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    const data = parse(updateArticleSchema, req.body);
    const article = await cfg.articleService.updateArticle(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      data,
    );
    res.json({ article });
  }

  async function setArticleStatus(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    const { status } = parse(articleStatusTransitionSchema, req.body);
    const article = await cfg.articleService.setArticleStatus(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
      status,
    );
    res.json({ article });
  }

  async function deleteArticle(req: Request, res: Response): Promise<void> {
    const id = requireContentId(req);
    await cfg.articleService.deleteArticle(
      { admin: requireActor(req), clientInfo: clientInfo(req) },
      id,
    );
    res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // Articles (public)
  // -------------------------------------------------------------------------
  async function listPublicArticles(req: Request, res: Response): Promise<void> {
    const query = parse(publicArticleQuerySchema, req.query);
    res.json(await cfg.articleService.listPublicArticles(query));
  }

  async function getPublicArticle(req: Request, res: Response): Promise<void> {
    const slug = parse(slugParamSchema, req.params.slug);
    const article = await cfg.articleService.getPublicArticleBySlug(slug);
    res.json({ article });
  }

  return {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listCategoryTree,
    listTags,
    createTag,
    deleteTag,
    listAdminArticles,
    getAdminArticle,
    createArticle,
    updateArticle,
    setArticleStatus,
    deleteArticle,
    listPublicArticles,
    getPublicArticle,
  };
}

export type ContentController = ReturnType<typeof createContentController>;
