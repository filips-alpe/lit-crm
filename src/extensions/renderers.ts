import type { RecordRenderer } from '$lib/renderers/registry';
import { collectRenderers } from './collect';

/**
 * Record renderers from every installed extension, appended to the built-in set.
 * Discovered, not registered: any `src/extensions/<id>/renderers/index.ts` that
 * exports `renderers: RecordRenderer[]` is picked up. Use `bun run ext` to
 * install and uninstall.
 */
export const extensionRenderers: RecordRenderer[] = collectRenderers(
  import.meta.glob<{ renderers: RecordRenderer[] }>('./*/renderers/index.ts', { eager: true }),
);
