import type { FormLayout } from '$lib/forms/layout';
import type { RecordFormOptions } from '$lib/forms/recordOptions';
import { resolveRecordOptions } from '$lib/server/repos/records';
import { resolveUserOptions } from '$lib/server/repos/users';
import { listProjectOptions } from '$lib/server/repos/projects';

/** The ids a layout's user/record fields currently hold in `values` (keyed by
 *  writeTo, like the record form data). */
function selectedIds(
  layout: FormLayout,
  kind: 'user' | 'record',
  values: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();
  for (const f of layout.fields) {
    const v = f.kind === kind ? values[f.writeTo] : undefined;
    if (typeof v === 'string' && v) ids.add(v);
  }
  return [...ids];
}

/**
 * Assemble the option data a record form needs. Relation pickers search on
 * demand (`/data/options`), so only the labels for the ids the form already
 * holds are shipped; the project list stays complete for the universal project
 * multiselect.
 */
export async function buildRecordFormOptions(
  layout: FormLayout,
  opts: { excludeRecordId?: string; values?: Record<string, unknown> } = {},
): Promise<RecordFormOptions> {
  const values = opts.values ?? {};
  const [users, records, projects] = await Promise.all([
    resolveUserOptions(selectedIds(layout, 'user', values)),
    resolveRecordOptions(selectedIds(layout, 'record', values)),
    listProjectOptions(),
  ]);
  return { users, records, projects, excludeRecordId: opts.excludeRecordId };
}
