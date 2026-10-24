/** A CSS hex colour (`#abc`, `abcdef`, ...) as lower-case digits without `#`; falls back to mid-grey when malformed. */
export function normalizeHex(color: string): string {
  const hex = color.replace(/^#/, '').toLowerCase();
  return /^([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex) ? hex : '999999';
}
