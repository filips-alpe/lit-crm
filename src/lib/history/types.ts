/** One line of a record's history, as the panel draws it (see `listRecordHistory`). */
export type HistoryEntry = {
  /** The history row id (bigint, as a string: it is also the paging cursor). */
  id: string;
  /** ISO timestamp. */
  at: string;
  /** A change to the record itself, or to its link with a project. */
  kind: 'record' | 'link';
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'REDACT';
  /** Who did it; null when the user is gone or was never recorded. */
  actorName: string | null;
  /** The columns an update changed, or the fields a redaction cleared. */
  changed: string[];
  /** The new value of each changed column the viewer may see (update rows only). */
  values: Record<string, unknown>;
  /**
   * For a changed relation column (creatorId, assigneeId, recordId): what its id points at.
   * The raw id is not in `values` for these columns. `label` is null when the viewer cannot read it, '' when it has no title.
   */
  refs: Record<string, { kind: 'user' | 'record'; label: string | null }>;
  /** The project of a link row (its code, else its id). */
  projectCode: string | null;
};

export type HistoryPage = {
  entries: HistoryEntry[];
  /** Pass as `beforeId` to read the next (older) page; null when this page was the last. */
  nextBefore: string | null;
};
