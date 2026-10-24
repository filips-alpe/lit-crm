/** Next index for a roving-tabindex radiogroup key, or null for keys it ignores. */
export function rovingIndex(key: string, i: number, len: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (i + 1) % len;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (i - 1 + len) % len;
    case 'Home':
      return 0;
    case 'End':
      return len - 1;
    default:
      return null;
  }
}
