/** Only same-origin relative paths are allowed, to avoid open redirects. */
export function safeRedirectTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}
