import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'sid';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface SessionPayload {
  uid: string;
  exp: number;
}

export function setSession(cookies: Cookies, uid: string, url: URL) {
  cookies.set(SESSION_COOKIE, encode(uid), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSession(cookies: Cookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function readSession(cookies: Cookies) {
  return decode(cookies.get(SESSION_COOKIE));
}

function secret() {
  const s = env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error('AUTH_SECRET must be set and at least 16 characters');
  }
  return s;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(uid: string) {
  const payload: SessionPayload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}` as const;
}

function decode(cookie: string | undefined) {
  if (!cookie) return null;
  const dot = cookie.indexOf('.');
  if (dot < 0) return null;
  const encoded = cookie.slice(0, dot);
  const signature = cookie.slice(dot + 1);

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as unknown;
    if (
      typeof raw !== 'object' ||
      raw === null ||
      typeof (raw as SessionPayload).uid !== 'string' ||
      typeof (raw as SessionPayload).exp !== 'number'
    ) {
      return null;
    }
    const payload = raw as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
