import { getContext, setContext } from 'svelte';

/** A selectable person for a `user` relation field. */
export interface UserOption {
  id: string;
  name: string;
  username: string;
  color: string;
  avatarSeed: string | null;
}

/** A selectable record for a `record` relation field. */
export interface RecordOption {
  id: string;
  label: string;
}

/** A selectable project for the universal project multiselect. */
export interface ProjectOption {
  id: string;
  code: string;
  color: string;
}

/** Options the record form needs to populate relation pickers + the project
 *  multiselect. Loaded server-side and handed to the form tree via context so
 *  the per-field input components can read them without prop threading. */
export interface RecordFormOptions {
  users: UserOption[];
  records: RecordOption[];
  projects: ProjectOption[];
}

const KEY = Symbol('record-form-options');

const EMPTY: RecordFormOptions = { users: [], records: [], projects: [] };

/** Provide the form options to descendants (called once at a form root). */
export function setRecordOptions(options: RecordFormOptions): void {
  setContext(KEY, options);
}

/** Read the form options; falls back to empty lists outside a provider. */
export function getRecordOptions(): RecordFormOptions {
  return getContext<RecordFormOptions>(KEY) ?? EMPTY;
}

/** Build the Svelte mount-context map for tests/standalone mounts, keeping the
 *  context key private to this module. */
export function recordOptionsContext(options: RecordFormOptions): Map<symbol, RecordFormOptions> {
  return new Map([[KEY, options]]);
}
