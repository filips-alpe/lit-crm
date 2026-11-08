import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { prisma } from '$lib/prisma';
import { clearSession, readSession } from '$lib/server/auth/session';
import { runAs } from '$lib/server/db/context';
import { UserStatus } from '../generated/prisma/enums';

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%paraglide.lang%', locale)
          .replace('%paraglide.dir%', getTextDirection(locale)),
    });
  });

const handleSession: Handle = async ({ event, resolve }) => {
  const session = readSession(event.cookies);
  // The lookup itself runs as the session's user: an inactive or unknown user is invisible
  // to the policies, so it is simply "no user".
  const user = session
    ? await runAs(session.uid, () =>
        prisma.user.findUnique({ where: { id: session.uid, status: UserStatus.ACTIVE } }),
      )
    : null;
  if (user) {
    event.locals.session = session!;
    event.locals.user = user;
  } else if (session) {
    clearSession(event.cookies);
  }

  // Every load, action and endpoint under resolve() inherits the context; no user = nobody.
  return runAs(user?.id ?? null, async () => await resolve(event));
};

export const handle: Handle = sequence(handleParaglide, handleSession);
