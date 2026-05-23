import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { User } from '../../../../generated/prisma/client';

export function requireUser(event: RequestEvent): User {
  if (!event.locals.user) throw redirect(303, '/login');
  return event.locals.user;
}
