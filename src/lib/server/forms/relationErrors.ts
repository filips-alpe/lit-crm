import { setError, type SuperValidated } from 'sveltekit-superforms';
import * as m from '$lib/paraglide/messages.js';
import { InvalidDateError, type RecordRelationErrors } from '$lib/server/repos/records';

/**
 * Translate {@link validateRecordRelations} errors onto a record form, one
 * field-level `setError` per bad relation, so the user sees which picker is
 * wrong instead of a generic 500.
 */
export function applyRecordRelationErrors(
  form: SuperValidated<Record<string, unknown>>,
  errors: RecordRelationErrors,
) {
  for (const [field, kind] of Object.entries(errors) as Array<
    [keyof RecordRelationErrors, 'notFound' | 'self']
  >) {
    const message =
      kind === 'self'
        ? m.proof_awful_osprey_treasure()
        : field === 'recordId'
          ? m.round_awake_mongoose_commend()
          : field === 'projectIds'
            ? m.honest_close_lynx_propel()
            : m.just_soft_rabbit_dream();
    setError(form, field, message);
  }
}

/**
 * Turn an {@link InvalidDateError} thrown by a record write into a field error
 * on the offending column (form keys are the layout's `writeTo` columns).
 * Returns false for any other error, which the caller rethrows.
 */
export function applyInvalidDateError(
  form: SuperValidated<Record<string, unknown>>,
  error: unknown,
): boolean {
  if (!(error instanceof InvalidDateError)) return false;
  setError(form, error.column, m.tangy_super_squirrel_hunt());
  return true;
}
