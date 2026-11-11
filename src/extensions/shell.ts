import type { ExtensionShell } from '$lib/extensions/types';
import { collectShell } from './collect';

/**
 * The shell slots (`Layout`, `Login`, `home`) provided by installed extensions; empty when none
 * is. Discovered, not registered: any `src/extensions/<id>/shell/index.ts` that exports
 * `shell: ExtensionShell` is picked up. Each slot may come from one extension only.
 */
export const extensionShell: ExtensionShell = collectShell(
  import.meta.glob<{ shell: ExtensionShell }>('./*/shell/index.ts', { eager: true }),
);
