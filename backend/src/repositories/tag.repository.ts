import { prisma } from '../db/client.ts';
import type { TagQuery, TagSortField } from '../validators/content.validators.ts';
import type { ContentTx } from './category.repository.ts';

const SORT_COLUMN: Record<TagSortField, string> = {
  name: 'name',
  created_at: 'created_at',
};

export const tagRepository = {
  findById(id: string, tx: ContentTx = prisma) {
    return tx.tag.findUnique({ where: { id } });
  },

  findBySlug(slug: string, tx: ContentTx = prisma) {
    return tx.tag.findUnique({ where: { slug } });
  },

  findByName(name: string, tx: ContentTx = prisma) {
    return tx.tag.findUnique({ where: { name } });
  },

  /** Unicité du nom sans tenir compte de la casse (antidoublon). */
  findByNameInsensitive(name: string, tx: ContentTx = prisma) {
    return tx.tag.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  },

  countArticles(id: string, tx: ContentTx = prisma) {
    return tx.articleTag.count({ where: { tag_id: id } });
  },

  /** Nombre de tags existants parmi les ids demandés (exactitude des associations). */
  countExistingIds(ids: string[], tx: ContentTx = prisma) {
    return tx.tag.count({ where: { id: { in: ids } } });
  },

  create(input: { name: string; slug: string }, tx: ContentTx = prisma) {
    return tx.tag.create({ data: input });
  },

  delete(id: string, tx: ContentTx = prisma) {
    return tx.tag.delete({ where: { id } });
  },

  async list(query: TagQuery) {
    const { page, pageSize, search, sort, order } = query;
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        orderBy: { [SORT_COLUMN[sort]]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tag.count({ where }),
    ]);

    const withCounts = await Promise.all(
      data.map(async (tag) => ({ ...tag, articles_count: await this.countArticles(tag.id) })),
    );

    return { data: withCounts, total };
  },
};
