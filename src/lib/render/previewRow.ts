import type { RecordFormOptions } from '$lib/forms/recordOptions';
import type { RendererProjectChip } from './props';

interface PreviewUser {
  id: string;
  name: string;
  username: string;
  color: string;
  avatarSeed: string | null;
}

/** The joined entities a live preview needs, resolved from the form's current ids
 *  against the loaded option lists. Mirrors the shape buildRendererProps reads off
 *  a saved row (creator/assignee/record + the project join), so an unsaved record's
 *  card can show relation labels and project chips before it is persisted. */
export interface PreviewRelations {
  creator?: PreviewUser;
  assignee?: PreviewUser;
  record?: { id: string; title: string };
  projects: { projectId: string; project: RendererProjectChip }[];
}

export function previewRelations(
  data: Record<string, unknown>,
  options: RecordFormOptions,
): PreviewRelations {
  const user = (id: unknown): PreviewUser | undefined => {
    if (typeof id !== 'string') return undefined;
    const u = options.users.find((x) => x.id === id);
    return u
      ? { id: u.id, name: u.name, username: u.username, color: u.color, avatarSeed: u.avatarSeed }
      : undefined;
  };

  const record = (() => {
    const id = data.recordId;
    if (typeof id !== 'string') return undefined;
    const r = options.records.find((x) => x.id === id);
    return r ? { id: r.id, title: r.label } : undefined;
  })();

  const ids = Array.isArray(data.projectIds) ? (data.projectIds as string[]) : [];
  const projects = ids
    .map((id) => options.projects.find((p) => p.id === id))
    .filter((p): p is RendererProjectChip => !!p)
    .map((p) => ({ projectId: p.id, project: { id: p.id, code: p.code, color: p.color } }));

  return { creator: user(data.creatorId), assignee: user(data.assigneeId), record, projects };
}
