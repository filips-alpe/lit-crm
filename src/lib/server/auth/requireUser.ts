import { error, redirect, type RequestEvent } from '@sveltejs/kit';
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

/** The signed-in admin; anyone else gets a 403 (guests are redirected to login first). The
 *  database refuses non-admin writes too; this gives a clean answer and hides admin screens. */
export function requireAdmin(event: RequestEvent, message = 'Administrators only'): User {
  const user = requireUser(event);
  if (!user.isAdmin) throw error(403, message);
  return user;
}
