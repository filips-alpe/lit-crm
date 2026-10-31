/** Only same-origin relative paths are allowed, to avoid open redirects. */
export function safeRedirectTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    // eslint-disable-next-line no-control-regex -- browsers strip these, so reject them
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return '/';
  return value;
}
