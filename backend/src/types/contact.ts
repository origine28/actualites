import type { ContactMessageStatus } from '../generated/prisma/enums.ts';

export interface ContactMessageView {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  user_id: string | null;
  user: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  status: ContactMessageStatus;
  created_at: Date;
  updated_at: Date;
}
