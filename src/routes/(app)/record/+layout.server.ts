import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { listTypesByLastUsed } from '$lib/server/repos/types';

export const load: LayoutServerLoad = async (event) => {
  requireUser(event);
  const types = await listTypesByLastUsed();
  return {
    types: types.map((t) => {
      const layout = t.layout as { fields?: unknown[] } | null;
      return {
        id: t.id,
        code: t.code,
        description: t.description,
        color: t.color,
        iconSeed: t.iconSeed,
        fieldCount: layout?.fields?.length ?? 0,
      };
    }),
  };
};
