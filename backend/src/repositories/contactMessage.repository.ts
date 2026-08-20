import { Prisma } from '../generated/prisma/client.ts';
import { prisma } from '../db/client.ts';
import type { ContactMessageQuery } from '../validators/contact.validators.ts';

export type ContactTx = Prisma.TransactionClient;

const CONTACT_MESSAGE_SELECT = {
  id: true,
  name: true,
  email: true,
  subject: true,
  message: true,
  ip: true,
  user_id: true,
  status: true,
  created_at: true,
  updated_at: true,
  user: {
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
    },
  },
} satisfies Prisma.ContactMessageSelect;

export type ContactMessageRow = Prisma.ContactMessageGetPayload<{ select: typeof CONTACT_MESSAGE_SELECT }>;

export interface CreateContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  user_id: string | null;
}

export const contactMessageRepository = {
  async create(input: CreateContactMessageInput, tx: ContactTx = prisma) {
    return tx.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        ip: input.ip,
        user_id: input.user_id,
      },
    });
  },

  async findById(id: string, tx: ContactTx = prisma): Promise<ContactMessageRow | null> {
    return tx.contactMessage.findUnique({
      where: { id },
      select: CONTACT_MESSAGE_SELECT,
    });
  },

  async list(query: ContactMessageQuery, tx: ContactTx = prisma): Promise<{ data: ContactMessageRow[]; total: number }> {
    const where: Prisma.ContactMessageWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search;
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) where.created_at.gte = new Date(query.from);
      if (query.to) where.created_at.lte = new Date(query.to);
    }

    const orderBy: Prisma.ContactMessageOrderByWithRelationInput = {
      [query.sort]: query.order,
    };

    const [data, total] = await Promise.all([
      tx.contactMessage.findMany({
        where,
        select: CONTACT_MESSAGE_SELECT,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      tx.contactMessage.count({ where }),
    ]);

    return { data, total };
  },

  async updateStatus(id: string, status: string, tx: ContactTx = prisma) {
    return tx.contactMessage.update({
      where: { id },
      data: { status: status as 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED' },
      select: CONTACT_MESSAGE_SELECT,
    });
  },

  async delete(id: string, tx: ContactTx = prisma) {
    return tx.contactMessage.delete({ where: { id } });
  },
};
