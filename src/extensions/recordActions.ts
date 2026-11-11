import type { RecordAction } from '$lib/extensions/types';
import { actionsForPlacement, collectRecordActions } from './collect';

/**
 * Record actions from installed extensions, ordered. Discovered, not registered: any
 * `src/extensions/<id>/recordActions.ts` that exports `recordActions: RecordAction[]` is picked up.
 */
export const extensionRecordActions: RecordAction[] = collectRecordActions(
  import.meta.glob<{ recordActions: RecordAction[] }>('./*/recordActions.ts', { eager: true }),
);

/** The actions registered for one placement, e.g. `actionsFor('detail')`. */
export const actionsFor = (placement: string): RecordAction[] =>
  actionsForPlacement(extensionRecordActions, placement);
