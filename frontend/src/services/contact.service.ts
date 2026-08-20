import type { ListResponse } from '../types/api.ts';
import type {
  ContactMessageView,
  ContactMessageQuery,
  CreateContactMessageInput,
} from '../types/contact.ts';
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
// Contact (USER)
// ---------------------------------------------------------------------------

export async function sendContactMessage(input: CreateContactMessageInput): Promise<void> {
  await api.post('/contact', input);
}

// ---------------------------------------------------------------------------
// Contact Messages (ADMIN)
// ---------------------------------------------------------------------------

export async function listContactMessages(query: ContactMessageQuery = {}): Promise<ListResponse<ContactMessageView>> {
  const { data } = await api.get<ListResponse<ContactMessageView>>(`/admin/contact-messages${toQueryString(query)}`);
  return data;
}

export async function getContactMessage(id: string): Promise<ContactMessageView> {
  const { data } = await api.get<{ message: ContactMessageView }>(`/admin/contact-messages/${id}`);
  return data.message;
}

export async function setContactMessageStatus(id: string, status: string): Promise<ContactMessageView> {
  const { data } = await api.patch<{ message: ContactMessageView }>(`/admin/contact-messages/${id}/status`, { status });
  return data.message;
}

export async function deleteContactMessage(id: string): Promise<void> {
  await api.delete(`/admin/contact-messages/${id}`);
}
