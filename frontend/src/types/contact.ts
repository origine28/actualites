import type { ListQuery } from './api.ts';

export type ContactMessageStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';

export interface ContactMessageUserRef {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

export interface ContactMessageView {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  user_id: string | null;
  user: ContactMessageUserRef | null;
  status: ContactMessageStatus;
  created_at: string;
  updated_at: string;
}

export interface ContactMessageQuery extends ListQuery {
  status?: ContactMessageStatus;
  from?: string;
  to?: string;
}

export interface CreateContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}
