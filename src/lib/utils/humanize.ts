// "cloudDrizzle" → "Cloud drizzle", "dice5" → "Dice 5", "placeFrom" → "Place from".
// Trailing or embedded digits are split off so the label reads naturally.
export function humanizeIdentifier(name: string | null | undefined): string {
  if (!name) return '';
  const spaced = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
