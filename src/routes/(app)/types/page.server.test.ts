import { describe, expect, it } from 'vitest';
import { actions, load } from './+page.server';
import { addType, getTypeById } from '$lib/server/repos/types';
import { createRecord } from '$lib/server/repos/records';
import { prisma } from '$lib/prisma';

function deleteEvent(id: string | null, user: object | null = { id: 'u1' }) {
  const body = new FormData();
  if (id !== null) body.set('id', id);
  return {
    request: new Request('http://localhost/types?/delete', { method: 'POST', body }),
    locals: user ? { user } : {},
  } as never;
}

describe('/types page', () => {
  it('load returns the current rows', async () => {
    await addType({ code: 'L1' });
    const data = await (load as never as (e: unknown) => Promise<{ rows: { code: string }[] }>)({
      locals: { user: { id: 'u1' } },
    } as never);
    expect(data.rows.map((r) => r.code)).toContain('L1');
  });

  it('load redirects unauthenticated callers to /login', async () => {
    await expect(
      (load as never as (e: unknown) => Promise<unknown>)({ locals: {} } as never),
    ).rejects.toSatisfy((e) => (e as { location?: string }).location === '/login');
  });

  it('load exposes each row createdAt for the list', async () => {
    await addType({ code: 'L2' });
    const data = await (load as never as (e: unknown) => Promise<{ rows: { createdAt: Date }[] }>)({
      locals: { user: { id: 'u1' } },
    } as never);
    expect(data.rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('delete soft-deletes the row and stays on the list', async () => {
    const saved = await addType({ code: 'RD1' });
    expect(await actions.delete(deleteEvent(saved.id))).toEqual({ deleted: saved.id });
    expect((await getTypeById(saved.id))?.status).toBe('INACTIVE');
  });

  it('delete soft-deletes a type with records, keeping them restorable', async () => {
    const saved = await addType({ code: 'RD2' });
    await createRecord({ typeId: saved.id, note: 'kept' });
    expect(await actions.delete(deleteEvent(saved.id))).toEqual({ deleted: saved.id });
    expect((await getTypeById(saved.id))?.status).toBe('INACTIVE');
    expect(await prisma.record.count({ where: { typeId: saved.id } })).toBe(1);
  });

  it('delete returns 404 for an unknown or missing id', async () => {
    expect(((await actions.delete(deleteEvent('ghost'))) as { status: number }).status).toBe(404);
    expect(((await actions.delete(deleteEvent(null))) as { status: number }).status).toBe(404);
  });

  it('delete redirects unauthenticated callers to /login', async () => {
    const saved = await addType({ code: 'RD3' });
    await expect(actions.delete(deleteEvent(saved.id, null))).rejects.toSatisfy(
      (e) => (e as { location?: string }).location === '/login',
    );
    expect((await getTypeById(saved.id))?.status).toBe('ACTIVE');
  });
});
