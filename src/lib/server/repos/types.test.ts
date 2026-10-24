import { describe, expect, it } from 'vitest';
import { prisma } from '$lib/prisma';
import {
  DuplicateCodeError,
  addType,
  getTypeById,
  listTypes,
  listTypesByLastUsed,
  permanentlyDeleteType,
  restoreType,
  saveType,
  softDeleteType,
  updateType,
} from './types';
import { createRecord } from './records';

describe('types repo', () => {
  it('addType creates a row with status ACTIVE', async () => {
    const row = await addType({ code: 'A' });
    expect(row.code).toBe('A');
    expect(row.status).toBe('ACTIVE');
    expect(typeof row.id).toBe('string');
  });

  it('getTypeById returns the saved row', async () => {
    const saved = await addType({ code: 'B', description: 'beta' });
    const fetched = await getTypeById(saved.id);
    expect(fetched?.id).toBe(saved.id);
    expect(fetched?.description).toBe('beta');
  });

  it('getTypeById returns null for unknown id', async () => {
    const fetched = await getTypeById('does-not-exist');
    expect(fetched).toBeNull();
  });

  it('addType throws DuplicateCodeError when code already exists', async () => {
    await addType({ code: 'DUP' });
    await expect(addType({ code: 'DUP' })).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it('updateType patches in place and returns the updated row', async () => {
    const saved = await addType({ code: 'U', description: 'old' });
    const updated = await updateType(saved.id, { description: 'new' });
    expect(updated?.id).toBe(saved.id);
    expect(updated?.description).toBe('new');
    expect(updated?.code).toBe('U');
  });

  it('updateType returns null for unknown id', async () => {
    const updated = await updateType('does-not-exist', { description: 'x' });
    expect(updated).toBeNull();
  });

  it('listTypes returns active rows before inactive, each ordered by code asc', async () => {
    const b = await addType({ code: 'B' });
    await addType({ code: 'A' });
    await addType({ code: 'C' });
    await softDeleteType(b.id);
    const rows = await listTypes();
    expect(rows.map((r) => r.code)).toEqual(['A', 'C', 'B']);
  });

  it('softDeleteType flips status to INACTIVE', async () => {
    const saved = await addType({ code: 'D' });
    const deleted = await softDeleteType(saved.id);
    expect(deleted?.status).toBe('INACTIVE');
    const reread = await getTypeById(saved.id);
    expect(reread?.status).toBe('INACTIVE');
  });

  it('restoreType flips status back to ACTIVE', async () => {
    const saved = await addType({ code: 'E' });
    await softDeleteType(saved.id);
    const restored = await restoreType(saved.id);
    expect(restored?.status).toBe('ACTIVE');
  });

  it('softDeleteType and restoreType return null for unknown id', async () => {
    expect(await softDeleteType('does-not-exist')).toBeNull();
    expect(await restoreType('does-not-exist')).toBeNull();
  });

  it('permanentlyDeleteType hard-deletes a type with no records', async () => {
    const saved = await addType({ code: 'PD1' });
    const result = await permanentlyDeleteType(saved.id);
    expect(result).toEqual({ kind: 'deleted' });
    expect(await getTypeById(saved.id)).toBeNull();
  });

  it('permanentlyDeleteType returns not-found for unknown id', async () => {
    const result = await permanentlyDeleteType('does-not-exist');
    expect(result).toEqual({ kind: 'not-found' });
  });

  it('permanentlyDeleteType refuses to delete a type that still has records', async () => {
    const saved = await addType({ code: 'PD2' });
    await createRecord({ typeId: saved.id, note: 'in use' });
    await createRecord({ typeId: saved.id, note: 'in use too' });
    const result = await permanentlyDeleteType(saved.id);
    expect(result).toEqual({ kind: 'has-records', recordCount: 2 });
    // row still exists
    expect((await getTypeById(saved.id))?.id).toBe(saved.id);
  });

  it('permanentlyDeleteType works on a soft-deleted (INACTIVE) type', async () => {
    const saved = await addType({ code: 'PD3' });
    await softDeleteType(saved.id);
    const result = await permanentlyDeleteType(saved.id);
    expect(result).toEqual({ kind: 'deleted' });
    expect(await getTypeById(saved.id)).toBeNull();
  });

  it('saveType creates when id is empty and reports kind=created', async () => {
    const result = await saveType({ id: '', code: 'NEW' });
    expect(result.kind).toBe('created');
    if (result.kind === 'created') expect(result.row.code).toBe('NEW');
  });

  it('saveType updates when id matches an existing row and reports kind=updated', async () => {
    const existing = await addType({ code: 'EX', description: 'old' });
    const result = await saveType({ id: existing.id, code: 'EX', description: 'fresh' });
    expect(result.kind).toBe('updated');
    if (result.kind === 'updated') expect(result.row.description).toBe('fresh');
  });

  it('saveType reports kind=not-found when id does not exist', async () => {
    const result = await saveType({ id: 'ghost', code: 'X' });
    expect(result.kind).toBe('not-found');
  });

  it('saveType propagates DuplicateCodeError on conflicting code', async () => {
    await addType({ code: 'TAKEN' });
    await expect(saveType({ id: '', code: 'TAKEN' })).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it('addType persists color and iconSeed', async () => {
    const row = await addType({ code: 'C1', color: '#ff8800', iconSeed: 'seed-x' });
    expect(row.color).toBe('#ff8800');
    expect(row.iconSeed).toBe('seed-x');
  });

  it('updateType patches color and iconSeed independently', async () => {
    const saved = await addType({ code: 'C2' });
    const u1 = await updateType(saved.id, { color: '#123456' });
    expect(u1?.color).toBe('#123456');
    expect(u1?.iconSeed).toBeNull();
    const u2 = await updateType(saved.id, { iconSeed: 'new-seed' });
    expect(u2?.color).toBe('#123456'); // unchanged
    expect(u2?.iconSeed).toBe('new-seed');
  });

  it('listTypesByLastUsed orders by oldest most-recent record first, never-used types first', async () => {
    const stale = await addType({ code: 'STALE' });
    const recent = await addType({ code: 'RECENT' });
    await addType({ code: 'NEVER' });
    await createRecord({ typeId: stale.id, note: 'old', date: '2026-01-01T00:00:00Z' });
    await createRecord({ typeId: recent.id, note: 'fresh', date: '2026-05-01T00:00:00Z' });
    const rows = await listTypesByLastUsed();
    const codes = rows.map((r) => r.code);
    expect(codes.indexOf('NEVER')).toBeLessThan(codes.indexOf('STALE'));
    expect(codes.indexOf('STALE')).toBeLessThan(codes.indexOf('RECENT'));
  });

  it('listTypesByLastUsed uses the latest dated record even when an undated one exists', async () => {
    const mixed = await addType({ code: 'MIXED' });
    const stale = await addType({ code: 'STALE2' });
    await createRecord({ typeId: mixed.id, note: 'dated', date: '2026-06-01T00:00:00Z' });
    await createRecord({ typeId: mixed.id, note: 'undated' });
    await createRecord({ typeId: stale.id, note: 'old', date: '2026-01-01T00:00:00Z' });
    const rows = await listTypesByLastUsed();
    const mixedRow = rows.find((r) => r.code === 'MIXED');
    expect(mixedRow?.lastUsedAt?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(rows.map((r) => r.code).indexOf('STALE2')).toBeLessThan(
      rows.map((r) => r.code).indexOf('MIXED'),
    );
  });

  it('listTypesByLastUsed ignores INACTIVE records', async () => {
    const t = await addType({ code: 'INACTREC' });
    const live = await createRecord({ typeId: t.id, note: 'a', date: '2026-01-01T00:00:00Z' });
    const gone = await createRecord({ typeId: t.id, note: 'b', date: '2026-09-01T00:00:00Z' });
    await prisma.record.update({ where: { id: gone.id }, data: { status: 'INACTIVE' } });
    const row = (await listTypesByLastUsed()).find((r) => r.code === 'INACTREC');
    expect(live.id).toBeTruthy();
    expect(row?.lastUsedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('listTypesByLastUsed excludes INACTIVE types', async () => {
    await addType({ code: 'LIVE' });
    const gone = await addType({ code: 'GONE' });
    await softDeleteType(gone.id);
    const rows = await listTypesByLastUsed();
    expect(rows.map((r) => r.code)).toContain('LIVE');
    expect(rows.map((r) => r.code)).not.toContain('GONE');
  });

  it('addType round-trips a non-empty layout JSON value', async () => {
    const layout = { fields: [{ id: 'note', kind: 'text', label: 'Note' }] };
    const saved = await addType({ code: 'L', layout });
    const reread = await getTypeById(saved.id);
    expect(reread?.layout).toEqual(layout);
  });
});
