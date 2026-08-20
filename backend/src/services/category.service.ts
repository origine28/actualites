import { prisma } from '../db/client.ts';
import { categoryRepository, type CategoryTreeItem } from '../repositories/category.repository.ts';
import type { ActorContext } from '../types/content.ts';
import type { Category } from '../types/prisma.ts';
import { ApiError } from '../utils/errors.ts';
import { pagination } from '../utils/pagination.ts';
import { normalizeSlug, uniqueSlug } from '../utils/slug.ts';
import type {
  CategoryQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../validators/content.validators.ts';
import { auditService } from './audit.service.ts';

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  status: 'ACTIVE' | 'INACTIVE';
  children_count: number;
  created_at: Date;
  updated_at: Date;
}

type CategoryRow = Pick<
  Category,
  'id' | 'name' | 'slug' | 'parent_id' | 'sort_order' | 'status' | 'created_at' | 'updated_at'
> & { children_count?: number };

function toCategoryView(cat: CategoryRow): CategoryView {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    parent_id: cat.parent_id,
    sort_order: cat.sort_order,
    status: cat.status,
    children_count: cat.children_count ?? 0,
    created_at: cat.created_at,
    updated_at: cat.updated_at,
  };
}

function toTreeView(node: CategoryTreeItem): CategoryTreeItem {
  return {
    ...node,
    children: node.children.map(toTreeView),
  };
}

/**
 * Règles de gestion des catégories :
 * - arborescence à un seul niveau parent (profondeur illimitée mais sans cycle),
 * - unicité du nom entre frères,
 * - slug unique global, généré automatiquement si absent, jamais confié tel quel,
 * - suppression refusée si la catégorie a des enfants ou des articles.
 * Chaque mutation produit un audit log (l'acteur provient de la session).
 */
export const categoryService = {
  async listAdmin(query: CategoryQuery) {
    const { data, total } = await categoryRepository.list(query);
    return {
      data: data.map(toCategoryView),
      pagination: pagination(query.page, query.pageSize, total),
    };
  },

  /** Arbre des catégories ACTIVE pour le site public (lecture seule). */
  async listUserTree() {
    const tree = await categoryRepository.listActiveTree();
    return tree.map(toTreeView);
  },

  async create(ctx: ActorContext, input: CreateCategoryInput) {
    const parentId = input.parent_id ?? null;
    if (parentId && !(await categoryRepository.findById(parentId))) {
      throw new ApiError(400, 'INVALID_CATEGORY', 'Categorie parente introuvable');
    }
    if (await categoryRepository.findSiblingByName(input.name, parentId)) {
      throw new ApiError(409, 'DUPLICATE_CATEGORY', 'Une categorie du meme nom existe deja a ce niveau');
    }

    const slug = input.slug
      ? await this.resolveExplicitSlug(input.slug)
      : await uniqueSlug(input.name, async (s) => !!(await categoryRepository.findBySlug(s)));

    const created = await categoryRepository.create({
      name: input.name,
      slug,
      parent_id: parentId,
      sort_order: input.sort_order,
      status: input.status,
    });

    await auditService.record(
      {
        userId: ctx.admin.id,
        action: 'CATEGORY_CREATED',
        entityType: 'category',
        entityId: created.id,
        metadata: { name: created.name, slug: created.slug, parent_id: created.parent_id },
        ip: ctx.clientInfo.ip,
        userAgent: ctx.clientInfo.userAgent,
      },
      prisma,
    );

    return toCategoryView(created);
  },

  async update(ctx: ActorContext, id: string, input: UpdateCategoryInput) {
    const target = await categoryRepository.findById(id);
    if (!target) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categorie introuvable');
    }

    const nextParentId = input.parent_id !== undefined ? input.parent_id : target.parent_id;
    if (input.parent_id !== undefined) {
      if (input.parent_id === target.id) {
        throw new ApiError(400, 'CATEGORY_CYCLE', 'Impossible de se rattacher a soi-meme');
      }
      if (input.parent_id !== null) {
        if (!(await categoryRepository.findById(input.parent_id))) {
          throw new ApiError(400, 'INVALID_CATEGORY', 'Categorie parente introuvable');
        }
        const ancestors = await categoryRepository.findAncestorIds(input.parent_id);
        if (ancestors.includes(target.id)) {
          throw new ApiError(400, 'CATEGORY_CYCLE', 'Impossible de creer un cycle dans l arborescence');
        }
      }
    }

    const nextSlug = input.slug !== undefined ? normalizeSlug(input.slug) : target.slug;
    if (nextSlug !== target.slug) {
      const existing = await categoryRepository.findBySlug(nextSlug);
      if (existing && existing.id !== target.id) {
        throw new ApiError(409, 'DUPLICATE_SLUG', 'Slug deja utilise');
      }
    }

    const nextName = input.name !== undefined ? input.name : target.name;
    if (nextName !== target.name || nextParentId !== target.parent_id) {
      const sibling = await categoryRepository.findSiblingByName(nextName, nextParentId);
      if (sibling && sibling.id !== target.id) {
        throw new ApiError(409, 'DUPLICATE_CATEGORY', 'Une categorie du meme nom existe deja a ce niveau');
      }
    }

    const changedFields = Object.keys(input);
    const updated = await categoryRepository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: nextSlug } : {}),
      ...(input.parent_id !== undefined ? { parent_id: nextParentId } : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    await auditService.record(
      {
        userId: ctx.admin.id,
        action: 'CATEGORY_UPDATED',
        entityType: 'category',
        entityId: id,
        metadata: { name: updated.name, slug: updated.slug, changedFields },
        ip: ctx.clientInfo.ip,
        userAgent: ctx.clientInfo.userAgent,
      },
      prisma,
    );

    return toCategoryView(updated);
  },

  async remove(ctx: ActorContext, id: string): Promise<void> {
    const target = await categoryRepository.findById(id);
    if (!target) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categorie introuvable');
    }
    if ((await categoryRepository.countChildren(id)) > 0) {
      throw new ApiError(409, 'CATEGORY_HAS_CHILDREN', 'Categorie ayant des sous-categories');
    }
    if ((await categoryRepository.countArticles(id)) > 0) {
      throw new ApiError(409, 'CATEGORY_IN_USE', 'Categorie utilisee par des articles');
    }

    await categoryRepository.delete(id);
    await auditService.record(
      {
        userId: ctx.admin.id,
        action: 'CATEGORY_DELETED',
        entityType: 'category',
        entityId: id,
        metadata: { name: target.name, slug: target.slug },
        ip: ctx.clientInfo.ip,
        userAgent: ctx.clientInfo.userAgent,
      },
      prisma,
    );
  },

  async resolveExplicitSlug(slug: string) {
    const normalized = normalizeSlug(slug);
    if (await categoryRepository.findBySlug(normalized)) {
      throw new ApiError(409, 'DUPLICATE_SLUG', 'Slug deja utilise');
    }
    return normalized;
  },
};

export type CategoryService = typeof categoryService;
