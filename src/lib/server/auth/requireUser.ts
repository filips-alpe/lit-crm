import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { User } from '../../../../generated/prisma/client';

export function requireUser(event: RequestEvent): User {
  if (!event.locals.user) {
    const { pathname, search } = event.url;
    const target =
      pathname === '/' && !search ? '' : `?redirectTo=${encodeURIComponent(pathname + search)}`;
    throw redirect(303, `/login${target}`);
  }
  return event.locals.user;
}
