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
  /** Only the users the form already references (labels for chips/previews);
   *  the picker searches the rest on demand via `/data/options`. */
  users: UserOption[];
  /** Only the records the form already references, as above. */
  records: RecordOption[];
  projects: ProjectOption[];
  /** The record being edited, so its own picker never offers it for self-link. */
  excludeRecordId?: string;
}

const KEY = Symbol('record-form-options');

const EMPTY: RecordFormOptions = { users: [], records: [], projects: [] };

/** The context gets its own copy of the option lists: pickers add the entries
 *  they select (see `rememberUser`/`rememberRecord`) and must not mutate load data. */
function ownCopy(options: RecordFormOptions): RecordFormOptions {
  return { ...options, users: [...options.users], records: [...options.records] };
}

/** Provide the form options to descendants (called once at a form root). */
export function setRecordOptions(options: RecordFormOptions): void {
  setContext(KEY, ownCopy(options));
}

/** Remember a user picked via search so chips/previews can label it. Call before
 *  writing the id to the form, so derived previews see it on recompute. */
export function rememberUser(options: RecordFormOptions, user: UserOption): void {
  if (!options.users.some((u) => u.id === user.id)) options.users.push(user);
}

/** Remember a record picked via search (see `rememberUser`). */
export function rememberRecord(options: RecordFormOptions, record: RecordOption): void {
  if (!options.records.some((r) => r.id === record.id)) options.records.push(record);
}

/** Read the form options; falls back to empty lists outside a provider. */
export function getRecordOptions(): RecordFormOptions {
  return getContext<RecordFormOptions>(KEY) ?? EMPTY;
}

/** Build the Svelte mount-context map for tests/standalone mounts, keeping the
 *  context key private to this module. */
export function recordOptionsContext(options: RecordFormOptions): Map<symbol, RecordFormOptions> {
  return new Map([[KEY, ownCopy(options)]]);
}
