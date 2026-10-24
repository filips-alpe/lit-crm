import { describe, expect, it } from 'vitest';
import { addType, updateType } from './types';

describe('type renderer selection — persistence', () => {
  it('stores rendererId on create', async () => {
    const row = await addType({ code: 'R1', rendererId: 'headline' });
    expect(row.rendererId).toBe('headline');
  });

  it('defaults rendererId to null', async () => {
    const row = await addType({ code: 'R2' });
    expect(row.rendererId).toBeNull();
  });

  it('updates rendererId', async () => {
    const created = await addType({ code: 'R3' });
    const updated = await updateType(created.id, { rendererId: 'headline' });
    expect(updated?.rendererId).toBe('headline');
  });

  it('clears rendererId when set to empty', async () => {
    const created = await addType({ code: 'R4', rendererId: 'headline' });
    const cleared = await updateType(created.id, { rendererId: '' });
    expect(cleared?.rendererId).toBeNull();
  });

  it('leaves rendererId untouched when not provided on update', async () => {
    const created = await addType({ code: 'R5', rendererId: 'headline' });
    const updated = await updateType(created.id, { description: 'changed' });
    expect(updated?.rendererId).toBe('headline');
  });
});
