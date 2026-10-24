import type { FormLayout } from '$lib/forms/layout';
import type { RecordFormOptions } from '$lib/forms/recordOptions';
import { listRecordOptions } from '$lib/server/repos/records';
import { listUserOptions } from '$lib/server/repos/users';
import { listProjectOptions } from '$lib/server/repos/projects';

/**
 * Assemble the option lists a record form needs: user/record picker options
 * (loaded only when the layout actually has that relation kind, to stay lean)
 * and — always — the project list for the universal project multiselect.
 */
export async function buildRecordFormOptions(
  layout: FormLayout,
  opts: { excludeRecordId?: string } = {},
): Promise<RecordFormOptions> {
  const hasUser = layout.fields.some((f) => f.kind === 'user');
  const hasRecord = layout.fields.some((f) => f.kind === 'record');
  return {
    users: hasUser ? await listUserOptions() : [],
    records: hasRecord ? await listRecordOptions({ excludeId: opts.excludeRecordId }) : [],
    projects: await listProjectOptions(),
  };
}
