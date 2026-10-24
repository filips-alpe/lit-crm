import { createAvatar } from '@dicebear/core';
import * as lorelei from '@dicebear/lorelei';
import { normalizeHex } from '$lib/icons/hex';

const avatarCache = new Map<string, string>();
const AVATAR_CACHE_MAX = 500;

/**
 * A user's avatar as a `data:` SVG URI, generated locally with the dicebear
 * `lorelei` style (no third-party request). `color` is the user's colour
 * (`#rrggbb`), used for the hair.
 */
export function avatarUrl(seed: string, color: string): string {
  const hair = normalizeHex(color);
  const key = `${seed}\u0000${hair}`;
  const hit = avatarCache.get(key);
  if (hit) return hit;
  const uri = createAvatar(lorelei, { seed, hairColor: [hair] }).toDataUri();
  if (avatarCache.size >= AVATAR_CACHE_MAX) avatarCache.clear();
  avatarCache.set(key, uri);
  return uri;
}
