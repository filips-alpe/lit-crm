import { describe, expect, it } from 'vitest';
import { previewRelations } from './previewRow';
import type { RecordFormOptions } from '$lib/forms/recordOptions';

const options: RecordFormOptions = {
  users: [
    { id: 'u1', name: 'Ada', username: 'ada', color: '#111111', avatarSeed: null },
    { id: 'u2', name: 'Bo', username: 'bo', color: '#222222', avatarSeed: 'seed' },
  ],
  records: [{ id: 'r1', label: 'Prior letter' }],
  projects: [{ id: 'p1', code: 'Alpha', color: '#333333' }],
};

describe('previewRelations', () => {
  it('resolves creator/assignee/record/projects from the option lists by id', () => {
    const out = previewRelations(
      { creatorId: 'u1', assigneeId: 'u2', recordId: 'r1', projectIds: ['p1'] },
      options,
    );
    expect(out.creator).toEqual({
      id: 'u1',
      name: 'Ada',
      username: 'ada',
      color: '#111111',
      avatarSeed: null,
    });
    expect(out.assignee).toMatchObject({ id: 'u2', name: 'Bo' });
    expect(out.record).toEqual({ id: 'r1', title: 'Prior letter' });
    expect(out.projects).toEqual([
      { projectId: 'p1', project: { id: 'p1', code: 'Alpha', color: '#333333' } },
    ]);
  });

  it('leaves unset relations undefined and projects empty', () => {
    const out = previewRelations({}, options);
    expect(out.creator).toBeUndefined();
    expect(out.assignee).toBeUndefined();
    expect(out.record).toBeUndefined();
    expect(out.projects).toEqual([]);
  });

  it('ignores ids that match no option', () => {
    const out = previewRelations({ creatorId: 'ghost', projectIds: ['nope', 'p1'] }, options);
    expect(out.creator).toBeUndefined();
    expect(out.projects).toEqual([
      { projectId: 'p1', project: { id: 'p1', code: 'Alpha', color: '#333333' } },
    ]);
  });
});
