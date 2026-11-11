import { resolve } from '$app/paths';
import * as m from '$lib/paraglide/messages.js';
import { sortNavItems } from '$extensions/collect';
import type { NavItem } from './types';

/** Ids of the built-in links; an extension's nav item may not reuse them. */
export const BUILTIN_NAV_IDS = ['data', 'types', 'admin'] as const;

/** The built-in links (`order` 100, 200, 300), in the same shape an extension's are. */
export function builtinNavItems(): NavItem[] {
  return [
    {
      id: 'data',
      href: resolve('/(app)/data'),
      label: () => m.tame_short_weasel_compose(),
      order: 100,
    },
    {
      id: 'types',
      href: resolve('/(app)/types'),
      label: () => m.quiet_pink_parrot_clasp(),
      order: 200,
    },
    {
      id: 'admin',
      href: resolve('/(app)/admin'),
      label: () => m.just_gaudy_penguin_drip(),
      order: 300,
      adminOnly: true,
    },
  ];
}

/** The links `user` sees: built-in plus extension items, `adminOnly` applied, ordered by `order`
 *  (default 1000), then id. */
export function mergeNav(
  builtin: NavItem[],
  extension: NavItem[],
  user: { isAdmin: boolean },
): NavItem[] {
  return sortNavItems([...builtin, ...extension].filter((i) => !i.adminOnly || user.isAdmin));
}
