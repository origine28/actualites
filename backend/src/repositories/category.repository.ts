import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import type { CategoryStatus } from '../generated/prisma/enums.ts';
import type { Category } from '../types/prisma.ts';
import type { CategoryQuery, CategorySortField } from '../validators/content.validators.ts';

export type ContentTx = Prisma.TransactionClient;

export interface CategoryTreeItem {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  status: CategoryStatus;
  created_at: Date;
  updated_at: Date;
  children: CategoryTreeItem[];
}

const SORT_COLUMN: Record<CategorySortField, string> = {
  name: 'name',
  sort_order: 'sort_order',
  created_at: 'created_at',
};

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  parent_id: true,
  sort_order: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

type ListRow = Pick<
  Category,
  'id' | 'name' | 'slug' | 'parent_id' | 'sort_order' | 'status' | 'created_at' | 'updated_at'
>;

export const categoryRepository = {
  findById(id: string, tx: ContentTx = prisma) {
    return tx.category.findUnique({ where: { id } });
  },

  findBySlug(slug: string, tx: ContentTx = prisma) {
    return tx.category.findUnique({ where: { slug } });
  },

  /** Vérifie l'unicité du nom parmi les catégories du même parent. */
  findSiblingByName(name: string, parentId: string | null, tx: ContentTx = prisma) {
    return tx.category.findFirst({ where: { name, parent_id: parentId } });
  },

  /** Cherche dans la chaine parent/ancêtre (détection de cycle / profondeur). */
  async findAncestorIds(startId: string, tx: ContentTx = prisma): Promise<string[]> {
    const ids: string[] = [];
    let currentId: string | null = startId;
    let depth = 0;
    while (currentId && depth < 20) {
      const row: { parent_id: string | null } | null = await tx.category.findUnique({
        where: { id: currentId },
        select: { parent_id: true },
      });
      if (!row?.parent_id) break;
      ids.push(row.parent_id);
      currentId = row.parent_id;
      depth++;
    }
    return ids;
  },

  countChildren(id: string, tx: ContentTx = prisma) {
    return tx.category.count({ where: { parent_id: id } });
  },

  countArticles(id: string, tx: ContentTx = prisma) {
    return tx.article.count({ where: { category_id: id, deleted_at: null } });
  },

  create(
    input: {
      name: string;
      slug: string;
      parent_id: string | null;
      sort_order: number;
      status: CategoryStatus;
    },
    tx: ContentTx = prisma,
  ) {
    return tx.category.create({ data: input });
  },

  update(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      parent_id: string | null;
      sort_order: number;
      status: CategoryStatus;
    }>,
    tx: ContentTx = prisma,
  ) {
    return tx.category.update({ where: { id }, data: input });
  },

  delete(id: string, tx: ContentTx = prisma) {
    return tx.category.delete({ where: { id } });
  },

  /** Arbre complet des catégories ACTIVE, trié par sort_order puis name. */
  async listActiveTree(): Promise<CategoryTreeItem[]> {
    const rows = await prisma.category.findMany({
      where: { status: 'ACTIVE' },
      select: LIST_SELECT,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
    return buildTree(rows);
  },

  async list(query: CategoryQuery) {
    const { page, pageSize, search, parent_id, status, sort, order } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(parent_id === null ? { parent_id: null } : parent_id ? { parent_id } : {}),
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ [SORT_COLUMN[sort]]: order }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where }),
    ]);

    const withMeta: Array<ListRow & { children_count: number }> = await Promise.all(
      data.map(async (row) => ({ ...row, children_count: await this.countChildren(row.id) })),
    );

    return { data: withMeta, total };
  },
};

function buildTree(rows: ListRow[]): CategoryTreeItem[] {
  const byId = new Map<string, CategoryTreeItem>();
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryTreeItem[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
