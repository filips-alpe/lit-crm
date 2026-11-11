import { BUILTIN_NAV_IDS } from '$lib/extensions/nav';
import type { NavItem } from '$lib/extensions/types';
import { collectNavItems } from './collect';

/**
 * Navigation links from installed extensions, ordered. Discovered, not registered: any
 * `src/extensions/<id>/nav.ts` that exports `navItems: NavItem[]` is picked up. An id may not
 * repeat or reuse a built-in one.
 */
export const extensionNavItems: NavItem[] = collectNavItems(
  import.meta.glob<{ navItems: NavItem[] }>('./*/nav.ts', { eager: true }),
  BUILTIN_NAV_IDS,
);
