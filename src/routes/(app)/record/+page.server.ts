import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import { buildRecordFormSchema, recordFormDefaults, toSaveInput } from '$lib/forms/layout';
import type { FormLayout } from '$lib/forms/layout';
import { createRecord, validateRecordRelations } from '$lib/server/repos/records';
import type { UpdateRecordInput } from '$lib/server/repos/records';
import { getTypeById } from '$lib/server/repos/types';
import { buildRecordFormOptions } from '$lib/server/recordFormOptions';
import { applyRecordRelationErrors } from '$lib/server/forms/relationErrors';
import * as m from '$lib/paraglide/messages.js';

async function loadLayout(url: URL): Promise<{ id: string; layout: FormLayout } | null> {
  const id = url.searchParams.get('type');
  if (!id) return null;
  const row = await getTypeById(id);
  const layout = row?.layout as FormLayout | null | undefined;
  if (!layout || layout.fields.length === 0) return null;
  return { id, layout };
}

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const selected = await loadLayout(event.url);
  if (!selected) return { form: null, layout: null, typeId: null };

  const initial = recordFormDefaults(selected.layout);
  const form = await superValidate(initial, zod4(buildRecordFormSchema(selected.layout)));
  const options = await buildRecordFormOptions(selected.layout);
  return { form, layout: selected.layout, typeId: selected.id, options };
};

export const actions: Actions = {
  save: async (event) => {
    const user = requireUser(event);
    const selected = await loadLayout(event.url);
    if (!selected) {
      const form = await superValidate(event.request, zod4(z.object({})));
      return fail(400, { form, error: m.brief_seemly_myna_ask() });
    }

    const schema = buildRecordFormSchema(selected.layout);
    const form = await superValidate(event.request, zod4(schema));
    if (!form.valid) return fail(400, { form });

    const input = toSaveInput(selected.layout, form.data as Record<string, unknown>);
    const str = (key: string) =>
      typeof input[key] === 'string' && input[key] ? (input[key] as string) : undefined;
    // A creator field in the layout lets the form pick the author; otherwise the
    // logged-in user owns the record.
    const creatorId = str('creatorId') ?? user.id;
    const assigneeId = str('assigneeId');
    const recordId = str('recordId');

    // projectIds is universal (not a layout column), so read it off the form data.
    const projectIds = form.data.projectIds as string[];

    const relationErrors = await validateRecordRelations({
      creatorId,
      assigneeId,
      recordId,
      projectIds,
    });
    if (relationErrors) {
      applyRecordRelationErrors(form, relationErrors);
      return fail(400, { form });
    }

    const saved = await createRecord({
      ...(input as UpdateRecordInput),
      typeId: selected.id,
      creatorId,
      projectIds,
    });
    return message(form, { saved });
  },
};
