import { error, fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/requireUser';
import {
  getCorrespondenceNeighbors,
  getRecordById,
  listCorrespondenceMap,
  updateRecord,
  validateRecordRelations,
  type UpdateRecordInput,
} from '$lib/server/repos/records';
import {
  buildRecordFormSchema,
  recordFormId,
  toSaveInput,
  valuesFromRecord,
} from '$lib/forms/layout';
import type { FormLayout } from '$lib/forms/layout';
import { layoutSchema } from '$lib/schemas/types';
import { buildRecordFormOptions } from '$lib/server/recordFormOptions';
import { applyInvalidDateError, applyRecordRelationErrors } from '$lib/server/forms/relationErrors';
import * as m from '$lib/paraglide/messages.js';

function parseLayout(raw: unknown): FormLayout {
  const parsed = layoutSchema.safeParse(raw);
  return parsed.success ? parsed.data : { fields: [] };
}

export const load: PageServerLoad = async (event) => {
  requireUser(event);
  const record = await getRecordById(event.params.id);
  if (!record) error(404, m.cozy_late_capybara_greet());

  const layout = parseLayout(record.type.layout);
  // Per-record form id: flipping the modal between letters mounts the next
  // detail form before the previous one is gone, and same-schema forms would
  // otherwise share superforms' schema-derived id.
  const form = await superValidate(
    { ...valuesFromRecord(layout, record), projectIds: record.projects.map((p) => p.projectId) },
    zod4(buildRecordFormSchema(layout)),
    { id: recordFormId(record.id) },
  );

  // The correspondence thread this letter belongs to (its from↔to stack); empty
  // unless both endpoints are set. The letter renderer surfaces it. The map plots
  // every letter of the type that carries coordinates; only fetched for types that
  // map a location field, other detail views ignore it.
  const hasLocation = layout.fields.some((f) => f.kind === 'location');
  const [thread, letters, options] = await Promise.all([
    getCorrespondenceNeighbors({
      id: record.id,
      from: record.from ?? '',
      to: record.to ?? '',
      typeId: record.typeId,
    }),
    hasLocation ? listCorrespondenceMap({ typeId: record.typeId }) : [],
    buildRecordFormOptions(layout, {
      excludeRecordId: record.id,
      values: form.data as Record<string, unknown>,
    }),
  ]);

  const type = {
    id: record.type.id,
    code: record.type.code,
    color: record.type.color,
    iconSeed: record.type.iconSeed,
    rendererId: record.type.rendererId ?? null,
    layout,
  };

  return { record, type, form, layout, thread, letters, options };
};

export const actions: Actions = {
  save: async (event) => {
    requireUser(event);
    const record = await getRecordById(event.params.id);
    if (!record) error(404, m.cozy_late_capybara_greet());

    const layout = parseLayout(record.type.layout);
    const form = await superValidate(event.request, zod4(buildRecordFormSchema(layout)), {
      id: recordFormId(record.id),
    });
    if (!form.valid) return fail(400, { form });

    const saveInput = toSaveInput(layout, form.data) as UpdateRecordInput;

    const projectIds = (form.data.projectIds as string[] | undefined) ?? [];
    const relationErrors = await validateRecordRelations(
      {
        creatorId: saveInput.creatorId,
        assigneeId: saveInput.assigneeId,
        recordId: saveInput.recordId,
        projectIds,
      },
      { currentId: record.id },
    );
    if (relationErrors) {
      applyRecordRelationErrors(form, relationErrors);
      return fail(400, { form });
    }

    try {
      await updateRecord(record.id, { ...saveInput, projectIds });
    } catch (err) {
      if (!applyInvalidDateError(form, err)) throw err;
      return fail(400, { form });
    }
    return message(form, { saved: true });
  },
};
