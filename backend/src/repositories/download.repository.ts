import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import type {
  DownloadCategoryQuery,
  DownloadQuery,
} from '../validators/download.validators.ts';
import type { DownloadPlatform, DownloadStatus, DownloadType } from '../generated/prisma/enums.ts';

export type DownloadTx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Sélections
// ---------------------------------------------------------------------------

export const DOWNLOAD_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  platform: true,
  version: true,
  filename: true,
  original_name: true,
  mime_type: true,
  size_bytes: true,
  sha256: true,
  download_category_id: true,
  author_id: true,
  status: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  author: {
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
    },
  },
  download_category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;

const DOWNLOAD_SORT_COLUMN: Record<string, string> = {
  created_at: 'created_at',
  updated_at: 'updated_at',
  published_at: 'published_at',
  title: 'title',
};

// ---------------------------------------------------------------------------
// DownloadCategory Repository
// ---------------------------------------------------------------------------

export const downloadCategoryRepository = {
  findById(id: string, tx: DownloadTx = prisma) {
    return tx.downloadCategory.findUnique({ where: { id } });
  },

  create(
    input: { name: string; slug: string; sort_order: number; status: string },
    tx: DownloadTx = prisma,
  ) {
    return tx.downloadCategory.create({
      data: {
        name: input.name,
        slug: input.slug,
        sort_order: input.sort_order,
        status: input.status as 'ACTIVE' | 'INACTIVE',
      },
    });
  },

  update(id: string, data: { name?: string; slug?: string; sort_order?: number; status?: string }, tx: DownloadTx = prisma) {
    const prismaData: Prisma.DownloadCategoryUpdateInput = {};
    if (data.name !== undefined) prismaData.name = data.name;
    if (data.slug !== undefined) prismaData.slug = data.slug;
    if (data.sort_order !== undefined) prismaData.sort_order = data.sort_order;
    if (data.status !== undefined) prismaData.status = data.status as 'ACTIVE' | 'INACTIVE';
    return tx.downloadCategory.update({
      where: { id },
      data: prismaData,
    });
  },

  delete(id: string, tx: DownloadTx = prisma) {
    return tx.downloadCategory.delete({ where: { id } });
  },

  async list(query: DownloadCategoryQuery) {
    const { page, pageSize, search } = query;
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};
    const [data, total] = await Promise.all([
      prisma.downloadCategory.findMany({
        where,
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.downloadCategory.count({ where }),
    ]);
    return { data, total };
  },

  async countDownloads(id: string): Promise<number> {
    return prisma.download.count({
      where: { download_category_id: id, deleted_at: null },
    });
  },
};

// ---------------------------------------------------------------------------
// Download Repository
// ---------------------------------------------------------------------------

export const downloadRepository = {
  findById(id: string, tx: DownloadTx = prisma) {
    return tx.download.findUnique({ where: { id } });
  },

  findBySlug(slug: string, tx: DownloadTx = prisma) {
    return tx.download.findUnique({ where: { slug } });
  },

  create(
    input: {
      title: string;
      slug: string;
      description: string | null;
      type: DownloadType;
      platform: DownloadPlatform;
      version: string | null;
      filename: string;
      original_name: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      sha256: string;
      download_category_id: string | null;
      author_id: string;
      status: DownloadStatus;
      published_at: Date | null;
    },
    tx: DownloadTx = prisma,
  ) {
    return tx.download.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        type: input.type,
        platform: input.platform,
        version: input.version,
        filename: input.filename,
        original_name: input.original_name,
        storage_path: input.storage_path,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        sha256: input.sha256,
        download_category_id: input.download_category_id,
        author_id: input.author_id,
        status: input.status,
        published_at: input.published_at,
      },
    });
  },

  update(id: string, data: {
    title?: string;
    slug?: string;
    description?: string | null;
    type?: DownloadType;
    platform?: DownloadPlatform;
    version?: string | null;
    filename?: string;
    original_name?: string;
    storage_path?: string;
    mime_type?: string;
    size_bytes?: number;
    sha256?: string;
    download_category_id?: string | null;
    status?: DownloadStatus;
    published_at?: Date | null;
    deleted_at?: Date | null;
  }, tx: DownloadTx = prisma) {
    return tx.download.update({
      where: { id },
      data,
    });
  },

  softDelete(id: string, tx: DownloadTx = prisma) {
    return tx.download.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },

  async list(query: DownloadQuery) {
    const { page, pageSize, search, status, type, platform, download_category_id, from, to, sort, order } = query;
    const where: Prisma.DownloadWhereInput = {
      deleted_at: null,
      ...(status ? { status: status as DownloadStatus } : {}),
      ...(type ? { type: type as DownloadType } : {}),
      ...(platform ? { platform: platform as DownloadPlatform } : {}),
      ...(download_category_id ? { download_category_id } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.download.findMany({
        where,
        select: DOWNLOAD_SELECT,
        orderBy: { [DOWNLOAD_SORT_COLUMN[sort] ?? 'created_at']: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.download.count({ where }),
    ]);
    return { data, total };
  },

  async listPublic(query: { page: number; pageSize: number; search?: string; type?: string; platform?: string; download_category_id?: string; sort: string; order: 'asc' | 'desc' }) {
    const { page, pageSize, search, type, platform, download_category_id, sort, order } = query;
    const where: Prisma.DownloadWhereInput = {
      status: 'PUBLISHED' as DownloadStatus,
      deleted_at: null,
      ...(type ? { type: type as DownloadType } : {}),
      ...(platform ? { platform: platform as DownloadPlatform } : {}),
      ...(download_category_id ? { download_category_id } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      prisma.download.findMany({
        where,
        select: DOWNLOAD_SELECT,
        orderBy: { [DOWNLOAD_SORT_COLUMN[sort] ?? 'published_at']: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.download.count({ where }),
    ]);
    return { data, total };
  },
};

// ---------------------------------------------------------------------------
// DownloadLog Repository
// ---------------------------------------------------------------------------

export const downloadLogRepository = {
  create(
    input: { user_id: string; download_id: string; ip: string | null },
    tx: DownloadTx = prisma,
  ) {
    return tx.downloadLog.create({
      data: {
        user_id: input.user_id,
        download_id: input.download_id,
        ip: input.ip,
      },
    });
  },
};
