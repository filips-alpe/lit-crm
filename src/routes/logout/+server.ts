import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSession } from '$lib/server/auth/session';

export const POST: RequestHandler = ({ cookies }) => {
  clearSession(cookies);
  redirect(303, '/login');
};
