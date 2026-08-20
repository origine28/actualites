import type { AuthUser, ClientInfo } from '../types/auth.ts';
import type { ContactMessageView } from '../types/contact.ts';
import { contactMessageRepository, type ContactMessageRow } from '../repositories/contactMessage.repository.ts';
import { auditService } from './audit.service.ts';
import { ApiError } from '../utils/errors.ts';
import type { ContactMessageQuery, CreateContactMessageInput } from '../validators/contact.validators.ts';

function toContactMessageView(row: ContactMessageRow): ContactMessageView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    ip: row.ip,
    user_id: row.user_id,
    user: row.user,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function pagination(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface ActorContext {
  user: AuthUser;
  clientInfo: ClientInfo;
}

export const contactService = {
  async create(
    input: CreateContactMessageInput,
    actor: ActorContext,
  ): Promise<void> {
    await contactMessageRepository.create({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      ip: actor.clientInfo.ip,
      user_id: actor.user.id,
    });

    await auditService.record({
      userId: actor.user.id,
      action: 'CONTACT_MESSAGE_CREATED',
      entityType: 'contact_message',
      ip: actor.clientInfo.ip,
      userAgent: actor.clientInfo.userAgent,
    });
  },

  async list(query: ContactMessageQuery) {
    const result = await contactMessageRepository.list(query);
    return {
      data: result.data.map(toContactMessageView),
      pagination: pagination(query.page, query.pageSize, result.total),
    };
  },

  async getById(id: string): Promise<ContactMessageView> {
    const row = await contactMessageRepository.findById(id);
    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Message introuvable');
    }
    return toContactMessageView(row);
  },

  async setStatus(
    id: string,
    status: string,
    actor: ActorContext,
  ): Promise<ContactMessageView> {
    const existing = await contactMessageRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Message introuvable');
    }

    const row = await contactMessageRepository.updateStatus(id, status);

    const actionMap: Record<string, string> = {
      READ: 'CONTACT_MESSAGE_READ',
      REPLIED: 'CONTACT_MESSAGE_REPLIED',
      ARCHIVED: 'CONTACT_MESSAGE_ARCHIVED',
    };

    await auditService.record({
      userId: actor.user.id,
      action: actionMap[status] ?? 'CONTACT_MESSAGE_STATUS_CHANGED',
      entityType: 'contact_message',
      entityId: id,
      metadata: { status },
      ip: actor.clientInfo.ip,
      userAgent: actor.clientInfo.userAgent,
    });

    return toContactMessageView(row);
  },

  async remove(id: string, actor: ActorContext): Promise<void> {
    const existing = await contactMessageRepository.findById(id);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Message introuvable');
    }

    await contactMessageRepository.delete(id);

    await auditService.record({
      userId: actor.user.id,
      action: 'CONTACT_MESSAGE_DELETED',
      entityType: 'contact_message',
      entityId: id,
      ip: actor.clientInfo.ip,
      userAgent: actor.clientInfo.userAgent,
    });
  },
};

export type ContactService = typeof contactService;
