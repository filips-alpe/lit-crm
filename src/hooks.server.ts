import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { prisma } from '$lib/prisma';
import { clearSession, readSession } from '$lib/server/auth/session';
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
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.uid, status: UserStatus.ACTIVE },
    });
    if (user) {
      event.locals.session = session;
      event.locals.user = user;
    }
  }

  if (session && !event.locals.user) {
    clearSession(event.cookies);
  }

  return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleSession);
