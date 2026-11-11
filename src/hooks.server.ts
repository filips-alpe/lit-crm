import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { prisma } from '$lib/prisma';
import { building } from '$app/environment';
import { assertAuthSecret, clearSession, readSession } from '$lib/server/auth/session';
import { runAs } from '$lib/server/db/context';
import { requireUser } from '$lib/server/auth/requireUser';
import { UserStatus } from '../generated/prisma/enums';

// The app refuses to start with a missing, short or placeholder AUTH_SECRET.
if (!building) assertAuthSecret();

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

// Extension routes (installed into src/routes/(app)/x/<id>) are for signed-in users only. The
// (app) layout's load already redirects pages, but form actions and +server endpoints never run
// it, so the guard sits here for every route under /x/. It matches the route id, not the URL:
// SvelteKit routes on the decoded path, so /%78/... would slip past a pathname check.
const handleExtensionRoutes: Handle = ({ event, resolve }) => {
  if (event.route.id?.startsWith('/(app)/x/')) requireUser(event);
  return resolve(event);
};

export const handle: Handle = sequence(handleParaglide, handleSession, handleExtensionRoutes);
